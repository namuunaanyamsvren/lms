#!/bin/sh
set -eu

backup_root=${POSTGRES_BACKUP_DIRECTORY:-/backups}
wal_archive=${POSTGRES_WAL_ARCHIVE_DIRECTORY:-/var/lib/postgresql/wal-archive}
restore_port=${POSTGRES_RESTORE_DRILL_PORT:-55432}
latest_backup=$(find "${backup_root}" -mindepth 1 -maxdepth 1 -type d -name 'base-*' | sort | tail -n 1)

if [ -z "${latest_backup}" ] || [ ! -f "${latest_backup}/data/PG_VERSION" ]; then
  echo "No valid base backup exists under ${backup_root}" >&2
  exit 2
fi

restore_root=$(mktemp -d /tmp/lms-pitr-drill.XXXXXX)
postgres_pid=''
cleanup() {
  if [ -n "${postgres_pid}" ] && kill -0 "${postgres_pid}" 2>/dev/null; then
    kill -TERM "${postgres_pid}"
    wait "${postgres_pid}" || true
  fi
  rm -rf -- "${restore_root}"
}
trap cleanup EXIT HUP INT TERM

cp -a "${latest_backup}/data/." "${restore_root}/"
rm -rf -- "${restore_root}/pg_wal"
mkdir -p "${restore_root}/pg_wal"
chown -R postgres:postgres "${restore_root}"
chmod 0700 "${restore_root}"

{
  echo "restore_command = 'cp ${wal_archive}/%f %p'"
  echo "recovery_target_action = 'promote'"
  if [ -n "${PITR_TARGET_TIME:-}" ]; then
    echo "recovery_target_time = '${PITR_TARGET_TIME}'"
    echo "recovery_target_inclusive = true"
  fi
} >> "${restore_root}/postgresql.auto.conf"
touch "${restore_root}/recovery.signal"
chown postgres:postgres "${restore_root}/postgresql.auto.conf" "${restore_root}/recovery.signal"

su-exec postgres postgres \
  -D "${restore_root}" \
  -p "${restore_port}" \
  -c listen_addresses=127.0.0.1 \
  -c unix_socket_directories=/tmp \
  -c archive_mode=off > "${restore_root}/restore.log" 2>&1 &
postgres_pid=$!

attempt=0
until pg_isready --host=127.0.0.1 --port="${restore_port}" --username="${POSTGRES_USER:-postgres}"; do
  attempt=$((attempt + 1))
  if [ "${attempt}" -ge 60 ] || ! kill -0 "${postgres_pid}" 2>/dev/null; then
    cat "${restore_root}/restore.log" >&2
    exit 1
  fi
  sleep 1
done

schema_count=$(psql \
  --host=127.0.0.1 \
  --port="${restore_port}" \
  --username="${POSTGRES_USER:-postgres}" \
  --dbname="${POSTGRES_DB:-lms_db}" \
  --tuples-only --no-align \
  --command="SELECT count(*) FROM information_schema.schemata
    WHERE schema_name IN ('auth','organization','academic','billing','notification')")

if [ "${schema_count}" -ne 5 ]; then
  echo "Restore drill recovered ${schema_count}/5 application schemas" >&2
  exit 1
fi

echo "[restore-drill] PITR startup and five-schema integrity check passed from ${latest_backup}"
