#!/bin/sh
# Migrate to head, then serve. The API is reached only by the web server inside the Compose
# network; nothing proxies it, so forwarded headers are not trusted.
set -eu
cd /srv/apps/api
alembic upgrade head
exec uvicorn paxpivot.api:app --host 0.0.0.0 --port 8000 --access-log --log-level info
