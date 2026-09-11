# TASK-033 — Terminal detail shows published departures

## Status

`blocked` — decisions delegated by the product owner (2026-09-11); see AUDIT.md §4/§6.

## Assigned role

`build`

## Goal

Extend the terminal detail read model and adapter so `opportunities` on `/terminals/{id}` lists
the parsed 72-hour departures for that terminal with the source state pill, the page's own time
if present, "as published" wording and the read time; `parser_review_required` rows render with
that state, never as fresh.

## Dependencies

TASK-032

## Owned paths

```text
apps/api/paxpivot/application/read_models.py, read_services.py (departures on TerminalDetailRead)
apps/web/lib/api/contracts.ts, lib/presentation/adapters/terminals.ts, tests
docs/tasks/TASK-033-terminal-detail-published-departures.md
```

## Acceptance criteria

- [ ] Departures appear only for terminals whose source policy allows display and whose rows passed the gate or are shown with their review state.
- [ ] No "no flights" wording; an empty list under a failed check says the check failed.
- [ ] JSON examples regenerated; adapter tests updated.
- [ ] Tests prove the behaviour; no unrelated files changed.

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

`docs/agent/MERGE_POLICY.md`; OPSEC review for anything touching source content.

## Out of scope

No trip context, no ranking.

## Blocked / contract change needed

See Dependencies.

## Handoff

(fill in per template)
