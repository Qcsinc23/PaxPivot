# Contributing to PaxPivot

PaxPivot uses contract-first, test-backed development. Human and agent contributors follow the same repository rules.

## Start here

Read `AGENTS.md` first. It defines instruction precedence and the multi-agent workflow.

## Working rules

1. Start from current `main`.
2. Work one task contract from `docs/tasks/` at a time.
3. Respect the task's owned paths and architecture boundaries.
4. Do not silently change shared contracts.
5. Add or update tests with behavior changes.
6. Keep commits focused and descriptive.
7. Do not mix unrelated cleanup/refactors into feature branches.
8. Never commit secrets, credentials, private trip data, movement rows that are not approved for repository use, or generated local environment files.

## Branch naming

```text
foundation/TASK-###-short-slug
build/TASK-###-short-slug
fix/TASK-###-short-slug
```

## Commit style

Use short conventional prefixes where practical:

```text
feat: ...
fix: ...
test: ...
docs: ...
refactor: ...
chore: ...
```

A commit should represent one coherent change.

## Pull requests

A PR should:

- identify its task contract;
- summarize behavior, not just files;
- call out shared contract/schema/migration changes;
- list exact verification commands and results;
- identify known limitations;
- avoid unrelated changes.

Dependent PRs must merge contract/foundation changes before consumer implementations.

## Definition of done

Use the task contract plus the repository-wide checks established by scaffolding. At minimum, changed behavior requires appropriate tests, and verification must be rerun after the final code change.

Never claim a test, build, lint, migration, or typecheck passes without running it successfully on the final change.

## Architecture changes

Changes that cross boundaries in `docs/architecture/BOUNDARIES.md` require an ADR under `docs/decisions/` and foundation-agent review before implementation proceeds.
