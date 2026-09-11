#!/bin/sh
# Migrate to head, then serve behind the reverse proxy (trust forwarded headers from it only).
set -eu
cd /srv/apps/api
alembic upgrade head
exec uvicorn paxpivot.api:app --host 0.0.0.0 --port 8000 --proxy-headers \
  --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-*}" --access-log --log-level info
