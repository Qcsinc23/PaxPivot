# TASK-014 — Profile, readiness and eligibility detail

## Status

`done` — merged to `main` in 650fce8; post-merge Quality green; Handoff recorded below (lifecycle: docs/agent/WORKFLOW.md §7).

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

- [x] Profile surface uses traveler wording (`Eligible · 2 travelers`, state text from the model) and links to eligibility detail; category codes appear only on the detail screen.
- [x] Readiness: `Progress` with "n of m ready" (unknown → "Unknown"), `ReadinessList` where each item's policy text is behind its "Why?" `Disclosure`, an "One thing we can't resolve" card with a single accent `Button` (the only accent action on the screen), and a sticky "Mark ready" action.
- [x] Eligibility detail: decision state as text, controlling policy id/version, citations as `EvidenceRows`, reasons and unresolved conditions as lists, traveler rows — all model-supplied; the screen evaluates nothing and stores nothing.
- [x] No medical, identity-document or credential fields anywhere.
- [x] Live routes render empty states; showcase renders fixtures.
- [x] Tests, axe, responsive and accessibility rules.

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

**Branch:** `build/TASK-014-profile-and-readiness` from `main` @ `aa41191` (TASK-013 merge).

**Commit:** Reported in the PR.

**Files changed** (all owned paths):

```text
apps/web/lib/presentation/screens/profile.ts        ProfileScreenModel, ReadinessView,
                                                    PartyMemberView, EligibilityDetailScreenModel,
                                                    EligibilityTravelerView, ELIGIBILITY_WORDING,
                                                    eligibilitySummaryText, emptyProfile,
                                                    emptyEligibilityDetail, fixtureProfile,
                                                    fixtureEligibilityDetail
apps/web/components/screens/profile/ProfileScreen.tsx
apps/web/components/screens/profile/ReadinessScreen.tsx
apps/web/components/screens/profile/EligibilityDetailScreen.tsx
apps/web/app/profile/page.tsx                        live surface (was the TASK-006 stub)
apps/web/app/profile/readiness/page.tsx              live readiness
apps/web/app/profile/eligibility/page.tsx            live eligibility detail
apps/web/app/showcase/profile/page.tsx               development-only
apps/web/app/showcase/profile/readiness/page.tsx     development-only
apps/web/app/showcase/profile/eligibility/page.tsx   development-only
apps/web/tests/screens/profile.test.tsx              24 tests
docs/tasks/TASK-014-profile-and-readiness.md
```

No file outside the owned paths was modified. `app/profile/**` was assigned to this task, so
replacing the `NotBuiltYet` stub there is in scope.

**Interfaces added/changed:** `ProfileScreenModel`, `ReadinessView`, `PartyMemberView`,
`EligibilityDetailScreenModel`, `EligibilityTravelerView`, `ELIGIBILITY_WORDING`,
`eligibilitySummaryText`, `emptyProfile`, `emptyEligibilityDetail`, `fixtureProfile`,
`fixtureEligibilityDetail`, `ProfileScreen({ model })`,
`ReadinessScreen({ status, model, backHref })`, `EligibilityDetailScreen({ model })`. No
foundation type, component, token, dependency or API/schema contract changed.

**Two links that were previously dangling now resolve:** TASK-007's plan settings `whyHref` and
TASK-013's alert `settingsHref` both point at `/profile`, which this task makes real.

**Migrations:** None.

**Verification run:** after the final change, on the exact head:

```text
make format-check -> PASS      make test-integration -> PASS (pytest 3)
make lint         -> PASS      make test             -> PASS
make typecheck    -> PASS      make build            -> PASS
make test-unit    -> PASS      make migrate          -> PASS
                               make migrate-check    -> PASS
                               make compose-check    -> PASS
```

Counts: pytest 156 unit + 3 integration; Vitest 15 files / 228 tests (24 new, all passing).

**Live responsive probe** (Next dev, real Chromium) on all six profile routes at 360 / 430 /
1280 px: no page-level sideways scroll and no overflowing element at any width; exactly one `h1`
per route; no skipped heading level; exactly one accent action on the readiness screen;
rail/bottom-nav swap at 60rem.

**Tests worth noting.** The readiness unknown case asserts "Unknown" *within the readiness card*
and that no progress bar is drawn — an unknown readiness must not become a 0-of-4 bar. The
accent test counts `[data-variant="accent"]` across the whole readiness screen and asserts it is
exactly one element whose text is the model's `acknowledgeLabel`, so a second accent action
anywhere would fail. The category-wording test asserts the profile surface contains no
"Category" text at all while the eligibility detail renders it once per traveler. A
`FORBIDDEN_FIELDS` scan asserts neither profile surface renders medical, passport, credential or
birth-date wording.

**Review findings corrected.** One assertion of mine was wrong rather than the code: the
notifications panel also renders "Unknown" (its revision-history row), so the unknown-readiness
assertion is now scoped to the readiness card instead of matching document-wide.

**Known limitations / risks:** `ELIGIBILITY_WORDING` and `eligibilitySummaryText` duplicate the
eligibility mapping TASK-007 defined inline in `PlanScreen.tsx`. TASK-014 may not edit that file,
so the duplication is unavoidable here; a foundation extraction of the eligibility wording into
`lib/presentation` is the right follow-up, alongside the `ScreenSection`/`SORT_OPTIONS` helpers
noted by TASK-007/009/010. The readiness "Acknowledge" and "Mark ready" actions are presented but
not wired, because acknowledgement submission is explicitly out of scope. Colour contrast remains
review-verified.

**Next dependency:** TASK-016's declared dependencies (TASK-009, TASK-012) are merged, so with
TASK-013 and TASK-014 done the remaining queue is TASK-016; TASK-015 stays blocked on the
foundation `AskAnswerView` contract.

