# Rules shared by every screen task (TASK-007 onward)

Each screen task file states its own goal, paths, interfaces, acceptance criteria and tests.
The rules below apply to all of them and are not repeated per task.

## Architecture

- Screens are pure compositions of the foundation (`docs/architecture/UI_FOUNDATION.md`):
  `components/ui/*`, `components/shell/*`, `components/paxpivot/*`, `lib/presentation/*`.
- A screen has three parts, all owned by its task:
  1. `apps/web/lib/presentation/screens/<screen>.ts` — the `…ScreenModel` type plus a
     synthetic `fixture…` value. The model composes existing presentation types only
     (`Fact<T>`, `SourceEvidenceView`, `RouteCardView`, …). Adding a field to a foundation
     type, a new shared component, token or dependency is a contract change: record it under
     "Blocked / contract change needed" and stop; do not derive it locally.
  2. `apps/web/components/screens/<Screen>.tsx` — `…Screen({ model })`, no data fetching, no
     domain decisions, no hard-coded example values (the static scan in
     `tests/showcase.test.tsx` enforces this for `components/**` and `app/**`).
  3. `apps/web/app/<route>/page.tsx` — until an API contract exists, renders the screen's
     honest empty/"not available" state (never fixture data), and
     `apps/web/app/showcase/<screen>/page.tsx` renders the screen from its fixture
     (development only; the showcase layout already returns 404 in production).
- Long explanations (TASK-002 wording, methodology, policy, provenance) stay behind
  `Disclosure`, `Sheet` or an Evidence/History tab. Surfaces show pills and one-liners.
- Traveler-facing wording on surfaces (`Eligible · 2 travelers`); category codes only under
  Profile/eligibility detail/evidence. History is descriptive counts with denominators only.
- Never present an observation as a reservation, a source failure as "no flights", unknown as
  zero, or history as probability. Route ranking labels come from the model (`Recommended`,
  `Safest overall`, `Best Space-A`, `Option n`), never computed in the screen.

## Responsive behaviour

- Build for a fluid mobile viewport first (test at 360–430px widths), then confirm the
  desktop shell (≥ 60rem) does not break: no horizontal scroll, content inside `pp-main`.
- Sticky actions use `StickyActionBar`; sheets use `Sheet`; do not create fixed-position
  elements of your own. Do not hard-code device sizes.

## Accessibility behaviour

- One `h1` via `AppHeader`; sections use `h2`, cards `h3` (use `headingLevel`).
- Every icon-only control uses `IconButton` with a `label`; every list is `ul`/`ol` with an
  accessible name where it is not obvious; tabs use `Tabs`; single-choice chips use
  `SegmentedControl`.
- Status meaning is always text (pills), never colour alone; unknowns render "Unknown".
- Add an axe assertion (`tests/a11y.ts`) on the screen rendered from its fixture, with
  `region` disabled when rendering outside the shell.

## Loading, empty and error states

- Every screen defines and tests its loading (`LoadingState` keeps identity and the previous
  timestamped result marked stale when the model provides one), empty (`EmptyState` with
  the next action) and error (`ErrorState`, "a failure on our side", never absence) states,
  driven by a `status` field on the screen model.

## Tests

- `apps/web/tests/screens/<screen>.test.tsx`: renders from the fixture; asserts the required
  labels/landmarks; asserts unknowns are not zero; asserts each state; runs axe.
- Use only the canonical root commands (`make …`); never add a package script or runner.

## Review and merge

- Follow `docs/agent/MERGE_POLICY.md`. The build agent may merge its own PR when: only owned
  paths changed; the Handoff table has fresh results for every canonical command; a fresh
  review in the PR records zero Critical and zero Important findings; the `scaffold` check is
  green on the exact head SHA; and `main` has been merged/rebased in before final verification.
- Any change outside owned paths, or any "Blocked / contract change needed" entry, requires
  foundation review before merge.
