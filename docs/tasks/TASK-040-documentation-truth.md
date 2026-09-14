# TASK-040 — Documentation truth pass and drift guard

## Status

`review` — PR open; see Handoff.

## Assigned role

`foundation`

## Goal

Every document an agent or contributor reads first states the repository's current truth, and the
mechanical claims in the README are enforced by a test. Task statuses name their real blockers.
The reconciled plan (2026-09-14) lives in the repository instead of a session scratchpad.

## Why this task exists

Three independent audits (architecture/ADRs, agent/deploy docs, task contracts) found the
committed documentation describing a TASK-001-era repository: the README said only `/health`
existed, no retrieval or trip storage was enabled and auth was deny-all; CONTRACTS.md said no live
adapter existed and omitted the trips vertical, `/ready` and two migrations; CONTRIBUTING said no
product tables existed; DEPLOYMENT told the operator to run `make` on a host without it; TASK-015
was `review` though merged; three blocked tasks pointed at AUDIT.md instead of their real blocker;
TASK-032 named a migration number already taken; and `CLAUDE.md` was committed as a symlink whose
target is prose, so it could not be read from disk at all. AGENTS.md's read order starts with
these files, so each false claim sends agents after code that does not exist or duplicates code
that does.

## Dependencies

- TASK-039, TASK-041, TASK-042 merged (the README and CONTRACTS.md describe their behaviour, and
  this task normalizes their statuses to `done`).

## Owned paths

```text
README.md, CONTRIBUTING.md, CLAUDE.md, AUDIT.md, IMPROVEMENT_LOG.md, .env.example
docs/DEPLOYMENT.md
docs/architecture/CONTRACTS.md, docs/architecture/UI_FOUNDATION.md
docs/decisions/ADR-004-sources-terminals-persistence.md   (amendment only)
docs/plans/2026-09-14-reconciled-plan.md                  (new)
docs/tasks/TASK-001, 005, 006, 015, 032, 033, 035, 036    (status lines; 032 migration number)
docs/tasks/TASK-039, 041, 042                             (status normalized to done after merge)
docs/tasks/TASK-040-documentation-truth.md
tests/unit/test_docs_consistency.py                       (new)
```

## Read-only context

```text
apps/api/paxpivot/api.py, apps/api/migrations/versions/, Makefile, apps/api/paxpivot/**
compose.prod.yml, deploy/, the pilot VPS cron files (read over SSH)
```

## Interfaces consumed

None (documentation and a read-only test).

## Interfaces produced

```text
tests/unit/test_docs_consistency.py: README route table == api.py routes (both directions);
  README migration range and next revision == migrations on disk; every TASK the README names is
  blocked or done, and every blocked contract is named; every documented `make` target exists;
  every relative link resolves
```

## Acceptance criteria

- [x] README states what works, what does not, the registered API surface, the blocked slices
      and their real blockers, and the commands; no numeric claim about contract counts.
- [x] The guard fails on each kind of drift (route missing or extra, stale migration range,
      unsettled or unnamed task, missing make target, dead link) and passes on the repository.
- [x] CONTRACTS.md lists the trips vertical, `/ready`, migrations 0004/0005, the Firecrawl
      adapter, the page-time parser, corpus capture, effective source state and the reliability
      report; no claim that no live adapter exists.
- [x] DEPLOYMENT.md matches the VPS as inspected (cron times, prune, UTC clock, no `make`, the
      Traefik override) and documents the source report and derived staleness.
- [x] CONTRIBUTING.md, UI_FOUNDATION.md, `.env.example` and ADR-004 (amendment) are current;
      AUDIT.md is marked as a superseded snapshot.
- [x] `CLAUDE.md` is a regular file with the same redirect text.
- [x] Task statuses: TASK-001/005/006 carry merge commits; TASK-015 is `done`; TASK-033/035/036
      name their real blockers; TASK-032 no longer names a taken migration.
- [x] No code behaviour changed.

## Required tests

```text
tests/unit/test_docs_consistency.py (5 tests)
```

## Verification commands

```bash
make setup
make check
make migrate-test
```

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies. Merges last in milestone M1 so the documents describe the
merged and deployed state.

## Out of scope

- Any code change, including the unused Redis/rq removal (decision D-6).
- Rewriting historical records (SCAFFOLD_EVIDENCE, ADR decision text, IMPROVEMENT_LOG runs 1–2).
- The PRDs.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `foundation/TASK-040-documentation-truth`

**Commit:** reported in the PR.

**Files changed:** the owned paths above.

**Interfaces added/changed:** see "Interfaces produced".

**Migrations:** none.

**Verification run:** recorded in the PR.

**Known limitations / risks:** the guard checks mechanical claims only; prose can still drift.

**Next dependency:** none in M1; M2 is the planner-path decision recorded in the plan.
