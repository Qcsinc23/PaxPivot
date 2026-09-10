# TASK-001 scaffold gate evidence

This maps every required group in docs/agent/SCAFFOLD_GATE.md to repository evidence.
The gate checklist itself is read-only for TASK-001 (outside its owned paths).
Fresh command results and integration status are recorded in TASK-001's Handoff.

| Gate group | Evidence |
| --- | --- |
| Layout and fixtures | apps/web, apps/api/paxpivot/{domain,application,infrastructure}, tests/{unit,integration,fixtures} |
| Package managers and exact runtimes | package.json, pnpm-workspace.yaml, pnpm-lock.yaml, pyproject.toml, uv.lock, .node-version, .python-version; make setup validates runtime pins |
| Environment | .env.example documents names only; setup generates private .env; .gitignore excludes secrets, private data and build state |
| Canonical commands | root Makefile and README command table cover all required logical operations |
| Local infrastructure | compose.yml includes Postgres/PostGIS and Redis with health checks, loopback bindings and named DB volume |
| Migrations | apps/api/migrations + Alembic; one head, PostGIS baseline, drift check, unique template0 test DB with cleanup |
| Shared contracts | CONTRACTS.md maps required symbols; tests/unit/test_contracts.py validates them |
| Quality gates | Ruff, mypy, ESLint, Prettier, pytest, Vitest, Next strict build; .github/workflows/quality.yml runs root make commands |
| Security/auth | DenyAllAuthenticator tested for missing/invented credentials; health-only API, no provider calls; allowlisted audit metadata, canonical startup disables access logs |
| Task system | TASK_TEMPLATE uses root commands; TASK-002–004 have independent owned paths, explicit signatures, tests and TASK-001 merge dependency |

Scaffold readiness does not grant production use, source processing, real auth, persistence
of private data, or a source-specific parser approval. The build gate also requires the
foundation to be merged into main; a passing local checkout alone does not release that dependency.
