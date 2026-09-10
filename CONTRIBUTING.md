# Contributing

Read AGENTS.md and its required documents first. Work in a short-lived task branch from
current main. One implementation unit owns one task file and a bounded set of paths.
Foundation owns shared contracts, dependency files, migrations, auth, CI and API composition.
Do not change either PRD in an implementation task.

Run `make setup`, then `make check` before committing a focused change. Run
`make migrate-test` for migration changes. These root commands are canonical; do not
substitute ad hoc checks in handoffs. `make format` fixes formatting. Record exact commands,
results, contracts, branch/commit and limitations in the task's Handoff section.

Update from current main before final verification. Do not begin a dependent build task
until its contracts are merged. Escalate missing contracts via the task/ADR process.

Migration authors use `uv run --frozen alembic -c apps/api/alembic.ini revision -m "description"`
for a manual revision. Tooling supplies DATABASE_URL for upgrade/check. Maintain one head;
never rewrite an applied migration. Root `make migrate-check` detects pending/conflicting
heads and unmodeled public-schema tables/columns. Migration tests create unique local
databases from template0 and always remove only their own database. Never run tests against
production. No product tables exist yet; define schema in a separate foundation task.

Keep fixtures synthetic and use example.invalid URLs. No source movement artifacts,
private trip details, identity documents, credentials or medical evidence in Git or logs.
No auth bypass: the current Authenticator adapter denies all credentials. The API has no
private endpoints. A real private resource requires a separate foundation auth decision.

The inherited CLAUDE.md is a malformed symlink in the initial repository. It is outside
TASK-001 ownership and remains unchanged. Canonical pytest commands set `--confcutdir=tests`
to isolate test collection from repository-root artifacts; use AGENTS.md directly.
