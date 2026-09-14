SHELL := /bin/sh
PY := uv run --frozen
.PHONY: setup format format-check lint typecheck test-unit test-integration test build services compose-check migrate migrate-check migrate-test seed check-sources source-report cold-start-check build-images build-images-check audit dev check
setup:
	pnpm install --frozen-lockfile
	uv sync --frozen
	$(PY) python -m paxpivot.tooling setup-env
format:
	$(PY) ruff format apps/api tests
	pnpm format
format-check:
	$(PY) ruff format --check apps/api tests
	pnpm format-check
lint:
	$(PY) ruff check apps/api tests
	pnpm lint
typecheck:
	$(PY) mypy
	pnpm typecheck
test-unit:
	$(PY) pytest --confcutdir=tests tests/unit
	pnpm test
services:
	docker compose up -d --wait
# Validates the local-dev topology (compose.yml) plus the production topology
# (compose.prod.yml + deploy/compose.traefik.yml). The prod file's `${VAR:?...}` interpolation
# needs real-shaped values to resolve; deploy/ci.env supplies obviously fake ones (never secrets)
# so this never depends on production credentials (TASK-047).
compose-check:
	docker compose config --quiet
	docker compose -f compose.prod.yml -f deploy/compose.traefik.yml --env-file deploy/ci.env config --quiet
test-integration: services
	$(PY) pytest --confcutdir=tests tests/integration
test: test-unit test-integration
build:
	uv build --no-sources
	pnpm build
migrate: services
	$(PY) python -m paxpivot.tooling migrate
migrate-check:
	$(PY) python -m paxpivot.tooling migrate-check
migrate-test: services
	$(PY) python -m paxpivot.tooling migrate-test
seed: migrate
	$(PY) python -m paxpivot.tooling seed
check-sources: migrate
	$(PY) python -m paxpivot.tooling check-sources
# Read-only source-health gate over the last DAYS (TASK-042); exit 1 = a source must stop.
DAYS ?= 30
source-report: migrate
	$(PY) python -m paxpivot.tooling source-report $(DAYS)
PAXPIVOT_TAG ?= local
build-images:
	docker build -f apps/api/Dockerfile -t paxpivot-api:$(PAXPIVOT_TAG) .
	docker build -f apps/web/Dockerfile -t paxpivot-web:$(PAXPIVOT_TAG) .
# CI gate (TASK-047): proves both deployable images still build (never pushes). Same build as
# `build-images`; kept as its own target so CI's intent reads as a check, not a release step.
build-images-check: build-images
# Dependency-vulnerability gate (TASK-047). Production JS deps via `pnpm audit --prod`;
# production Python deps via a uv-exported, unhashed requirements list piped into pip-audit
# (`--disable-pip` skips pip's own resolver, `--no-deps` audits exactly the pinned set instead of
# re-resolving transitive deps; the local `-e .` package itself is skipped with a warning, which
# is expected). Needs network access to the advisory databases.
audit:
	pnpm audit --prod --audit-level high
	uv export --frozen --no-dev --no-hashes | uvx pip-audit -r /dev/stdin --disable-pip --no-deps
# Destroys this checkout's local database volume; proves first-boot readiness (TASK-028).
CYCLES ?= 20
cold-start-check:
	$(PY) python -m paxpivot.tooling cold-start-check $(CYCLES)
dev:
	$(PY) python -m paxpivot.tooling dev
check: format-check lint typecheck test build migrate migrate-check compose-check
