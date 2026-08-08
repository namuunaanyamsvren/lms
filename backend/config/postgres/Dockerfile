FROM postgres:15-alpine

RUN mkdir -p /var/lib/postgresql/wal-archive /backups \
    && chown -R postgres:postgres /var/lib/postgresql/wal-archive /backups \
    && chmod 0700 /var/lib/postgresql/wal-archive /backups

COPY archive-wal.sh backup-once.sh backup-loop.sh restore-drill.sh /usr/local/bin/
COPY pg_hba.conf /etc/postgresql/lms-pg_hba.conf
RUN chmod 0644 /etc/postgresql/lms-pg_hba.conf
RUN chmod 0755 \
    /usr/local/bin/archive-wal.sh \
    /usr/local/bin/backup-once.sh \
    /usr/local/bin/backup-loop.sh \
    /usr/local/bin/restore-drill.sh
