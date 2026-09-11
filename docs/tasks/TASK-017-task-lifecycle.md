# TASK-017 — Canonical task lifecycle and status normalization

## Status

`review` — this PR; becomes `done` once merged (see Handoff).

## Assigned role

`foundation`

## Goal

Define one canonical task lifecycle (`blocked → ready → in_progress → review → done`), state
exactly what establishes `done`, and normalize the already-merged task files so autonomous
agents can read task status without consulting chat history.

## Why this task exists

TASK-007 through TASK-016 merged while their files still said `review`, and TASK-002 through
TASK-004 still said `ready`. Autonomous agents use task status as a dispatch signal, so an
ambiguous status either blocks ready work or re-dispatches finished work. AGENTS.md's task
rule and WORKFLOW.md §7 needed an explicit lifecycle rather than an implied one.

## Dependencies

None.

## Owned paths

```text
docs/agent/WORKFLOW.md              (§7 only)
docs/tasks/TASK_TEMPLATE.md         (Status section only)
docs/tasks/TASK-002-*.md … TASK-004-*.md, TASK-007-*.md … TASK-014-*.md, TASK-016-*.md (Status line only)
docs/tasks/TASK-017-task-lifecycle.md
```

## Read-only context

```text
AGENTS.md
docs/agent/MERGE_POLICY.md
```

## Interfaces consumed

None.

## Interfaces produced

The lifecycle vocabulary in `docs/agent/WORKFLOW.md` §7 (documentation contract only).

## Acceptance criteria

- [x] WORKFLOW.md §7 defines the five statuses, who sets each, and the three conditions for `done`
      (merge commit on `main`, post-merge Quality green, Handoff complete).
- [x] The template's Status section points at that definition and shows how to record the merge SHA.
- [x] Every merged task file (002–004, 007–014, 016) reads `done` with its merge commit SHA;
      TASK-015 stays `blocked`; TASK-001/005/006 already read `done`.
- [x] No file outside the owned paths changed; no code changed.

## Required tests

None (documentation only). CI's `make check` still runs unchanged.

## Verification commands

```bash
make setup
make format-check
make lint
make typecheck
make test-unit
make test-integration
make test
make build
make migrate
make migrate-check
make compose-check
```

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies.

## Out of scope

- No change to MERGE_POLICY.md, AGENTS.md or any Handoff section.
- No change to the lifecycle of PRs (branch protection) — only task-file status semantics.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `foundation/TASK-017-task-lifecycle` from `main` @ `49e4505`.

**Commit:** reported in the PR.

**Files changed:** the owned paths above.

**Interfaces added/changed:** none (documentation).

**Migrations:** none.

**Verification run:** recorded in the PR after the final change.

**Known limitations / risks:** status is a coordination signal, not proof; Git history wins.

**Next dependency:** TASK-018 (UI foundation stabilization).
