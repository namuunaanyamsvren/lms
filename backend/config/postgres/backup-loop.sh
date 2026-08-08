#!/bin/sh
set -eu

interval_seconds=${POSTGRES_BACKUP_INTERVAL_SECONDS:-86400}
case "${interval_seconds}" in
  *[!0-9]*|'') echo "POSTGRES_BACKUP_INTERVAL_SECONDS must be an integer" >&2; exit 2 ;;
esac
if [ "${interval_seconds}" -lt 3600 ]; then
  echo "POSTGRES_BACKUP_INTERVAL_SECONDS must be at least 3600" >&2
  exit 2
fi

while true; do
  if ! /usr/local/bin/backup-once.sh; then
    echo "[backup] Backup failed; retrying after interval" >&2
  fi
  sleep "${interval_seconds}"
done
