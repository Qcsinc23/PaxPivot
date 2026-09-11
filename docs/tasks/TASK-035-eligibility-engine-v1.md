# TASK-035 — Eligibility engine v1 (versioned policy, pilot traveler class)

## Status

`blocked` — decisions delegated by the product owner (2026-09-11); see AUDIT.md §4/§6.

## Assigned role

`foundation`

## Goal

Versioned policy rows (`policy_versions`, `eligibility_rules`) seeded from the pilot baseline for
one traveler class, a deterministic `decide_eligibility(party, policy) -> EligibilityDecision`
with citations and unresolved conditions, exposed on the trip's read model and on Profile.

## Dependencies

TASK-034 + product owner confirms the pilot traveler class and policy citations

## Owned paths

```text
apps/api/paxpivot/domain/eligibility.py (existing contracts), application/eligibility.py, migration, seed
apps/web adapters for Plan/Profile eligibility pills
docs/decisions/ADR-007-eligibility-policy-data.md, docs/tasks/TASK-035-eligibility-engine-v1.md
```

## Acceptance criteria

- [ ] Rules are data with a version and citations; no rule text lives in UI components.
- [ ] Unknown stays unknown; outside-scope classes return `outside_supported_scope`.
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

No broad category support, no LLM.

## Blocked / contract change needed

See Dependencies.

## Handoff

(fill in per template)
