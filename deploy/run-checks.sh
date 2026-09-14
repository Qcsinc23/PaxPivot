#!/bin/sh
# Runs the periodic source-check pass (TASK-024/025) and pings an optional dead-man heartbeat on
# success. Invoked every 6 hours by deploy/cron/paxpivot-checks; see docs/DEPLOYMENT.md.
#
# A dead-man monitor alerts when a ping is MISSING, not when one arrives, so a stopped cron, a
# crashed container or a hung `docker compose exec` all surface the same way: silence. The ping
# only fires on a clean exit; a real check-sources failure (bad Firecrawl key, provider outage)
# must also go silent rather than paper over the failure with a "we're alive" ping.
#
# The ping itself is best-effort: a monitor outage or a network blip must never turn a genuinely
# successful check-sources run into a reported failure (that would make the "monitor" the least
# reliable part of the system), so a failing curl only logs a line and this script still exits 0.
set -eu

cd /opt/paxpivot

log_file="/opt/paxpivot/backups/checks.log"
env_file="/opt/paxpivot/.env.production"

compose() {
	docker compose --env-file "$env_file" -f compose.prod.yml -f deploy/compose.traefik.yml "$@"
}

status=0
compose exec -T api python -m paxpivot.tooling check-sources >>"$log_file" 2>&1 || status=$?

if [ "$status" -eq 0 ]; then
	# Read only PAXPIVOT_HEARTBEAT_URL; never source the whole env file (it holds other secrets).
	heartbeat_url=$(grep -m1 '^PAXPIVOT_HEARTBEAT_URL=' "$env_file" 2>/dev/null | cut -d '=' -f2-) || heartbeat_url=""
	# Tolerate a trailing CR (CRLF env file) and one layer of surrounding quotes.
	heartbeat_url=$(printf '%s' "$heartbeat_url" | tr -d '\r')
	case "$heartbeat_url" in
		\"*\")
			heartbeat_url=${heartbeat_url#\"}
			heartbeat_url=${heartbeat_url%\"}
			;;
		\'*\')
			heartbeat_url=${heartbeat_url#\'}
			heartbeat_url=${heartbeat_url%\'}
			;;
	esac
	if [ -n "$heartbeat_url" ]; then
		curl_status=0
		curl -fsS -m 10 --retry 3 "$heartbeat_url" >/dev/null 2>&1 || curl_status=$?
		if [ "$curl_status" -ne 0 ]; then
			# Never log the URL itself (it may embed a per-monitor secret token).
			printf '%s heartbeat ping failed (curl exit %s)\n' "$(date -u +%FT%TZ)" "$curl_status" >>"$log_file"
		fi
	fi
fi

exit "$status"
