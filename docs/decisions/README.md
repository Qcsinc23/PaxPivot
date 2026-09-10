# Architecture Decision Records

Use this directory only for decisions that materially affect how PaxPivot is built or how components depend on one another.

## When to create an ADR

Create one for changes to:

- framework/runtime/database choices;
- domain boundaries;
- persistence strategy;
- public/internal API contracts;
- provider interface strategy;
- routing algorithm architecture;
- auth/security model;
- source-processing or dissemination architecture;
- deployment topology;
- cross-package dependency direction.

Do not create ADRs for routine implementation details.

## Naming

```text
ADR-001-short-decision-title.md
ADR-002-next-decision.md
```

## Template

```markdown
# ADR-000 — Decision title

## Status

Proposed | Accepted | Superseded | Rejected

## Context

What problem or constraint requires a decision?

## Decision

What are we choosing?

## Alternatives considered

What credible alternatives were rejected, and why?

## Consequences

What becomes easier, harder, or constrained?

## Contract impact

List exact schemas/interfaces/packages affected.

## Migration / rollout

How will existing code/data move safely, if applicable?

## Verification

What tests/checks prove the decision is implemented correctly?
```

Accepted ADRs are repository truth until superseded by a later ADR. Do not rewrite history by editing an accepted ADR to describe a different decision; create a superseding ADR instead.
