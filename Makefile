SHELL := /bin/sh
PY := uv run --frozen
.PHONY: setup format format-check lint typecheck test-unit test-integration test build services compose-check migrate migrate-check migrate-test seed dev check
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
compose-check:
	docker compose config --quiet
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
dev:
	$(PY) python -m paxpivot.tooling dev
check: format-check lint typecheck test build migrate migrate-check compose-check
