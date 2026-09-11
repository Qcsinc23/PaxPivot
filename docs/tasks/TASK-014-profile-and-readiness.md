# TASK-014 — Profile, readiness and eligibility detail

## Status

`ready` — dispatch after TASK-006 is merged to main. Read `docs/tasks/SCREEN_TASK_RULES.md` first.

## Assigned role

`build`

## Goal

Implement the Profile destination: traveler/party summary in traveler-facing wording, the "Before you go" readiness screen (progress, item rows with per-item "Why?", the one unresolved item with an Acknowledge action), notification preferences summary, and an eligibility detail screen where category terminology lives.

## Why this task exists

PRD §8 (eligibility is deterministic, versioned and explainable), pilot §11.2 onboarding/readiness (category attestation without medical evidence, accompaniment, document conflict alert, acknowledgement). Category codes belong here, not on planning surfaces.

## Dependencies

- Required merged task/contract: `TASK-006`

## Owned paths

```text
apps/web/app/profile/**
apps/web/app/showcase/profile/**
apps/web/components/screens/profile/**
apps/web/lib/presentation/screens/profile.ts
apps/web/tests/screens/profile.test.tsx
docs/tasks/TASK-014-profile-and-readiness.md
```

## Read-only context

```text
docs/architecture/UI_FOUNDATION.md
apps/web/components/**
apps/web/lib/presentation/**
apps/api/paxpivot/domain/eligibility.py (shape reference only; never duplicated or evaluated in the browser)
```

## Interfaces consumed

```text
components/ui: AppHeader, IconButton, Card, Rows/Row, Progress, StatusPill, Button, StickyActionBar, Disclosure, Sheet
components/paxpivot: ReadinessList, ReadinessItem, EvidenceRows, SourceStateBadge
lib/presentation/types: ReadinessItemView, EligibilitySummaryView, EvidenceRowView, SourceEvidenceView, Fact
```

## Interfaces produced

```text
lib/presentation/screens/profile.ts::ProfileScreenModel (status; eligibility: EligibilitySummaryView;
  party: readonly { id; name; roleText; href }[]; readiness: { done: Fact<number>; total: Fact<number>; dueText?; items: readonly ReadinessItemView[];
  unresolved?: { title; body; acknowledgeLabel }; markReadyLabel };
  notifications: { rows: readonly EvidenceRowView[]; href }; advancedHref)
lib/presentation/screens/profile.ts::EligibilityDetailScreenModel (status; decision: EligibilitySummaryView["state"];
  policy: { id; version; citations: readonly EvidenceRowView[] }; reasons: readonly string[]; unresolved: readonly string[];
  travelers: readonly { id; name; roleText; categoryText; ageBandText; accompaniedText }[])
lib/presentation/screens/profile.ts::fixtureProfile, fixtureEligibilityDetail
components/screens/profile/ProfileScreen.tsx, ReadinessScreen.tsx, EligibilityDetailScreen.tsx
```

## Acceptance criteria

- [ ] Profile surface uses traveler wording (`Eligible · 2 travelers`, state text from the model) and links to eligibility detail; category codes appear only on the detail screen.
- [ ] Readiness: `Progress` with "n of m ready" (unknown → "Unknown"), `ReadinessList` where each item's policy text is behind its "Why?" `Disclosure`, an "One thing we can't resolve" card with a single accent `Button` (the only accent action on the screen), and a sticky "Mark ready" action.
- [ ] Eligibility detail: decision state as text, controlling policy id/version, citations as `EvidenceRows`, reasons and unresolved conditions as lists, traveler rows — all model-supplied; the screen evaluates nothing and stores nothing.
- [ ] No medical, identity-document or credential fields anywhere.
- [ ] Live routes render empty states; showcase renders fixtures.
- [ ] Tests, axe, responsive and accessibility rules.

## Required tests

```text
apps/web/tests/screens/profile.test.tsx — traveler wording on surface; category text only on detail; readiness progress; disclosure closed by default; single accent action; axe
```

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

## Out of scope

- No authentication, persistence, eligibility evaluation, acknowledgement submission or notification settings mutation.

## Blocked / contract change needed

`None`

## Handoff

(fill in per template)
