#!/bin/sh
set -eu

backup_root=${POSTGRES_BACKUP_DIRECTORY:-/backups}
retention_days=${POSTGRES_BACKUP_RETENTION_DAYS:-14}
postgres_host=${POSTGRES_HOST:-postgres}
postgres_port=${POSTGRES_PORT:-5432}
postgres_user=${POSTGRES_USER:-postgres}

case "${backup_root}" in
  /backups|/backups/*) ;;
  *) echo "POSTGRES_BACKUP_DIRECTORY must be /backups or a child directory" >&2; exit 2 ;;
esac
case "${retention_days}" in
  *[!0-9]*|'') echo "POSTGRES_BACKUP_RETENTION_DAYS must be an integer" >&2; exit 2 ;;
esac
if [ "${retention_days}" -lt 1 ]; then
  echo "POSTGRES_BACKUP_RETENTION_DAYS must be at least 1" >&2
  exit 2
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
final_directory="${backup_root}/base-${timestamp}"
temporary_directory="${backup_root}/.base-${timestamp}.partial"
umask 077
mkdir -p "${backup_root}"
trap 'rm -rf -- "${temporary_directory}"' EXIT HUP INT TERM

pg_basebackup \
  --host="${postgres_host}" \
  --port="${postgres_port}" \
  --username="${postgres_user}" \
  --pgdata="${temporary_directory}/data" \
  --format=plain \
  --wal-method=stream \
  --checkpoint=fast \
  --label="lms-${timestamp}" \
  --progress

pg_verifybackup "${temporary_directory}/data"
psql \
  --host="${postgres_host}" \
  --port="${postgres_port}" \
  --username="${postgres_user}" \
  --dbname="${POSTGRES_DB:-lms_db}" \
  --tuples-only \
  --no-align \
  --command="SELECT json_build_object(
    'createdAt', CURRENT_TIMESTAMP,
    'serverVersion', current_setting('server_version'),
    'database', current_database(),
    'walArchiveMode', current_setting('archive_mode')
  )" > "${temporary_directory}/manifest.json"
chmod -R go-rwx "${temporary_directory}"
mv "${temporary_directory}" "${final_directory}"
trap - EXIT HUP INT TERM

find "${backup_root}" \
  -mindepth 1 -maxdepth 1 -type d -name 'base-*' \
  -mtime "+${retention_days}" -exec rm -rf -- {} +

echo "[backup] Verified base backup created at ${final_directory}"
