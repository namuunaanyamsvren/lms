#!/bin/sh
set -eu

source_path=${1:?WAL source path is required}
wal_filename=${2:?WAL filename is required}
archive_root=${POSTGRES_WAL_ARCHIVE_DIRECTORY:-/var/lib/postgresql/wal-archive}
destination="${archive_root}/${wal_filename}"
temporary="${destination}.partial.$$"

umask 077
mkdir -p "${archive_root}"

if [ -f "${destination}" ]; then
  cmp -s "${source_path}" "${destination}"
  exit $?
fi

trap 'rm -f -- "${temporary}"' EXIT HUP INT TERM
cp "${source_path}" "${temporary}"
chmod 0600 "${temporary}"
mv "${temporary}" "${destination}"
trap - EXIT HUP INT TERM
