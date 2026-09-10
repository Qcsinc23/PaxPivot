## Task

Task contract: `docs/tasks/TASK-___-____.md`

## What changed

Describe the behavior delivered and why.

## Owned paths

Confirm the PR stayed within the task's owned paths, or explain every authorized exception.

## Shared contract / schema impact

- [ ] No shared contract change
- [ ] Shared contract change documented in task/ADR
- [ ] Database migration included and documented
- [ ] API/domain contract change called out explicitly

Details:

## Source / policy impact

- [ ] No source-processing/policy impact
- [ ] Relevant `SourceProcessingPolicy` / eligibility / dissemination rule was reviewed

Details:

## Verification

List the exact commands run on the final change and their results.

```text
command -> PASS/FAIL
```

- [ ] Targeted tests pass
- [ ] Repository-required test suite passes for affected scope
- [ ] Lint/format passes
- [ ] Typecheck passes
- [ ] Build passes when applicable
- [ ] Migration checks pass when applicable

## Failure / unknown-state coverage

Describe the failure, stale, unknown, denied, or edge cases tested.

## Handoff

- Interfaces added/changed:
- Migrations:
- Known limitations:
- Next dependent task:

## Scope check

- [ ] No unrelated cleanup/refactor bundled into this PR
- [ ] No secrets/private trip data/unapproved movement data committed
- [ ] Task handoff section is updated
