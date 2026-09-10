# PaxPivot Agent Instructions

`AGENTS.md` is the canonical cross-harness instruction entrypoint for all coding agents working in this repository.

## Read order

Before changing code or project structure, read:

1. `AGENTS.md`
2. `PAXPIVOT_PRODUCTION_PRD.md` — authoritative production product/development scope
3. `paxpivot.md` — inherited validation, privacy/OPSEC, source-handling, failure-state, parser-correctness, uncertainty, and no-guarantee baseline
4. `docs/architecture/BOUNDARIES.md` — component/dependency boundaries
5. `docs/agent/WORKFLOW.md` — multi-agent workflow
6. the assigned file under `docs/tasks/`
7. relevant implementation/tests

For the initial scaffold, also read `docs/agent/SCAFFOLD_GATE.md`.

## Instruction precedence

1. Current user/product-owner instruction
2. `PAXPIVOT_PRODUCTION_PRD.md` for product scope
3. The stricter applicable rule between the production PRD and `paxpivot.md` for source truth, dissemination, privacy/OPSEC, uncertainty, parser correctness, and no-guarantee behavior
4. Accepted ADRs in `docs/decisions/`
5. `docs/architecture/BOUNDARIES.md`
6. Assigned task contract
7. Existing implementation conventions

Do not silently resolve a material conflict in code. Record/escalate it through the task/ADR process.

## Product invariants

- PaxPivot is an end-to-end Space-A journey planner, not a raw schedule board.
- Deterministic eligibility, source-state, opportunity, and route engines are authoritative.
- AI may interpret intent and explain structured results; it may not invent or override flights, seat states, policy rules, eligibility decisions, route edges, provider confirmations, or probabilities.
- A source observation is not a reservation or guaranteed flight.
- Unknown/stale/conflicting/unreachable/restricted states remain visible; source failure never becomes “no flights.”
- Do not implement boarding/completion/route-success probabilities until the production PRD prediction gate is explicitly satisfied and enabled.
- Never bypass source access controls or process restricted/CUI material outside an approved source-processing policy.
- Preserve provenance for consequential derived records.

## Multi-agent ownership

PaxPivot is intentionally designed for a stronger **foundation/scaffold agent** plus a faster **build agent**.

### Foundation/scaffold agent owns shared contracts

By default this includes:

- repository/toolchain scaffolding;
- dependency/runtime choices;
- domain contracts and shared types;
- database schema/migrations;
- API/provider interfaces;
- auth/security boundaries;
- routing-engine interfaces;
- CI/lint/typecheck/test infrastructure;
- architectural decisions and cross-cutting refactors.

### Build agent implements behind stable contracts

Appropriate work includes bounded endpoints, screens/components, provider adapters, parsers/fixtures, focused jobs/services, and tests that do not require silently changing shared contracts.

If the build agent needs a shared contract change, stop that task and use the workflow in `docs/agent/WORKFLOW.md`.

## Task rule

One implementation unit = one task file under `docs/tasks/` based on `docs/tasks/TASK_TEMPLATE.md`.

Respect:

- owned paths;
- consumed/produced interfaces;
- task dependencies;
- acceptance criteria;
- exact verification commands;
- explicit out-of-scope items.

Do not bundle unrelated cleanup or refactors into a task.

## Verification rule

Never claim a test, lint, typecheck, migration check, build, or behavior passes without running the relevant command successfully after the final change.

Before handoff:

1. run targeted tests;
2. run repository-required affected checks;
3. confirm no unrelated files changed;
4. update the task `Handoff` section;
5. document contract/migration changes;
6. commit a focused change.

## Architecture changes

Changes to framework/runtime/database choices, domain boundaries, persistence strategy, provider interfaces, source-processing/security model, routing architecture, auth model, deployment topology, or cross-package dependency direction require an ADR under `docs/decisions/` and foundation-agent review.

## Build order

Follow the production PRD milestone sequence:

**foundation → source truth → direct planner → production UX → temporal graph → Ask PaxPivot → historical intelligence**

Do not skip ahead in a way that duplicates or weakens unfinished foundations.

## Documentation discipline

- Keep this file concise and cross-harness.
- Do not duplicate these rules into harness-specific instruction files.
- `CLAUDE.md` should only redirect Claude-compatible agents here.
- Do not rewrite accepted ADR history; supersede with a new ADR.
- Do not modify either PRD unless a task explicitly authorizes product/spec changes.
