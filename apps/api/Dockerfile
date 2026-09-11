# PaxPivot API image. Build from the repository root: docker build -f apps/api/Dockerfile .
FROM python:3.12.13-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.6.9 /uv /usr/local/bin/uv
WORKDIR /srv
COPY pyproject.toml uv.lock ./
COPY apps/api ./apps/api
RUN uv sync --frozen --no-dev --no-editable

FROM python:3.12.13-slim
RUN useradd --system --uid 10001 paxpivot
WORKDIR /srv
COPY --from=build /srv/.venv /srv/.venv
COPY apps/api/alembic.ini apps/api/migrations ./apps/api/
COPY deploy/api-entrypoint.sh /usr/local/bin/api-entrypoint
ENV PATH="/srv/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PAXPIVOT_ALEMBIC_INI=/srv/apps/api/alembic.ini
USER paxpivot
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD python -c "import urllib.request,sys;sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/ready',timeout=2).status==200 else 1)"
ENTRYPOINT ["api-entrypoint"]
