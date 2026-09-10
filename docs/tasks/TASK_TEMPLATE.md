# TASK-000 — Short task title

> Copy this file to `docs/tasks/TASK-###-short-slug.md` for each implementation unit. Delete instructional text when filling it in.

## Status

`ready | in_progress | blocked | review | done`

## Assigned role

`foundation | build | either`

## Goal

One concrete, independently testable outcome.

## Why this task exists

Link the exact production PRD milestone/requirement and explain the user-visible or architectural value in 2–4 sentences.

## Dependencies

- Required merged task/contract: `TASK-___`
- Required ADR, if any: `ADR-___`
- Required interface/schema: exact path + symbol

Use `None` when there are no dependencies.

## Owned paths

The assigned agent may edit only these paths unless this task explicitly says otherwise.

```text
path/to/owned/file-or-directory
```

## Read-only context

Files/interfaces the agent should inspect but not change:

```text
PAXPIVOT_PRODUCTION_PRD.md
docs/architecture/BOUNDARIES.md
```

## Interfaces consumed

List exact contracts. Example:

```text
apps/api/paxpivot/domain/source.py::SourceState
apps/api/paxpivot/application/ports/source_provider.py::SourceProvider
```

Use `None` if this task is creating the first contract.

## Interfaces produced

List the exact public contracts this task is allowed to create/change. Example:

```text
SourceProvider.probe(source: Source) -> SourceProbeResult
```

If this section changes a shared contract, `Assigned role` should normally be `foundation`.

## Acceptance criteria

- [ ] Specific observable behavior 1
- [ ] Specific observable behavior 2
- [ ] Failure/unknown behavior is covered
- [ ] Tests prove the behavior
- [ ] No unrelated files changed

## Required tests

List exact test cases, including at least one failure/edge case when applicable.

```text
tests/unit/...
tests/integration/...
```

## Verification commands

Use exact commands. Replace examples after scaffolding establishes the repository commands.

```bash
# targeted test
<exact command>

# repository-required checks affected by this task
<exact command>
```

A task cannot move to `done` unless these commands were run successfully after the final change.

## Out of scope

Explicitly state nearby work the agent must not implement in this task.

- Not included: ...
- Do not refactor: ...

## Blocked / contract change needed

`None`

If blocked, describe the smallest shared contract/architecture change required. Do not implement the workaround silently.

## Handoff

Fill this in before review/done.

**Branch:**

**Commit:**

**Files changed:**

**Interfaces added/changed:**

**Migrations:**

**Verification run:**

```text
command -> PASS/FAIL summary
```

**Known limitations / risks:**

**Next dependency:**
