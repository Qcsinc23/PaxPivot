#!/bin/sh
# Takes a daily pg_dump and logs success or failure. Invoked at 03:15 UTC by
# deploy/cron/paxpivot-backup; see docs/DEPLOYMENT.md. Retention (30 days) is enforced here so a
# stuck cron entry can't silently stop pruning independently of the dump step.
set -eu

cd /opt/paxpivot

backup_dir="/opt/paxpivot/backups"
log_file="$backup_dir/backup.log"
env_file="/opt/paxpivot/.env.production"
dump_file="$backup_dir/paxpivot-$(date -u +%F).dump"

compose() {
	docker compose --env-file "$env_file" -f compose.prod.yml -f deploy/compose.traefik.yml "$@"
}

if compose exec -T postgres pg_dump -U paxpivot -Fc paxpivot >"$dump_file" 2>>"$log_file"; then
	printf '%s backup ok: %s\n' "$(date -u +%FT%TZ)" "$dump_file" >>"$log_file"
else
	status=$?
	printf '%s backup FAILED (exit %s): %s\n' "$(date -u +%FT%TZ)" "$status" "$dump_file" >>"$log_file"
	rm -f "$dump_file"
	exit "$status"
fi

find "$backup_dir" -name 'paxpivot-*.dump' -mtime +30 -delete
