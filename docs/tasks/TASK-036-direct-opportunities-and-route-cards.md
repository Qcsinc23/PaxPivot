# TASK-036 — Direct Space-A opportunities, route cards and commercial baseline handoff

## Status

`blocked` — decisions delegated by the product owner (2026-09-11); see AUDIT.md §4/§6.

## Assigned role

`foundation`

## Goal

Opportunity builder: parsed rows × eligible party × trip window → `SpaceAOpportunity` records
(never from `parser_review_required` rows); a direct route per opportunity as a `RouteCardView`
with the existing comparator fields where known and unknown elsewhere; a commercial baseline card
built as a Google Flights prefilled handoff (COM-001) with fare unknown; honest absence panel
otherwise. Results/Compare/Route Detail adapters wired to a `GET /api/v1/trips/{id}/routes`.

## Dependencies

TASK-032, TASK-034, TASK-035

## Owned paths

```text
apps/api/paxpivot/application/opportunities.py, routes.py, read_models.py, api.py; migration for opportunities
apps/web adapters for Results/Compare/Route Detail; tests
docs/decisions/ADR-008-direct-planner.md, docs/tasks/TASK-036-direct-opportunities-and-route-cards.md
```

## Acceptance criteria

- [ ] An opportunity is never created from an unreviewed row or an ineligible party.
- [ ] Ranking uses the PRD comparator with unknowns never treated as zero; no probability anywhere.
- [ ] Every handoff carries the mandatory label; the commercial card never shows a PaxPivot fare.
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

No multi-hop, no ground routing (drive time stays unknown), no notifications.

## Blocked / contract change needed

See Dependencies.

## Handoff

(fill in per template)
