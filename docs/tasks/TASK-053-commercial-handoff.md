# TASK-053 — Commercial fallback handoff on the trip page (COM-001..004)

## Status

`in_progress`

## Assigned role

`build`

## Goal

On `/trips/{tripId}`, below "Terminals to check", show a commercial fallback card that hands the
traveler off to a prefilled Google Flights search built from the trip's own destination text,
window dates and party size, plus a small curated list of nearby commercial airports for the
origin terminal. The card never shows or stores a fare, never claims a booking, and always offers
a plain, un-prefilled second link for when the prefill does not match.

## Why this task exists

PAXPIVOT_PRODUCTION_PRD.md §4.2/§4.3 and paxpivot.md COM-001..004 require that once PaxPivot has
told a traveler which Space-A terminals to check (TASK-044), it also gives them an honest,
non-fabricated path to a commercial alternative — without pretending to know fares, availability,
or whether Space-A will fly at all. GND-003 requires the "Live handoff" label on every provider
handoff; PRV-003 requires the destination never leave the traveler's own browser via a PaxPivot
server request.

## Dependencies

- Required merged task/contract: `TASK-034` (trip requests — `TripRead`), `TASK-044` (terminals to
  check; this task's card sits directly below it on the same page)
- Required ADR, if any: `None` (this task reuses `HandoffLabel`/`Fact`/`Card`/`FactStrip` per
  ADR-003 and does not add a foundation component, token or dependency)
- Required interface/schema: `apps/web/lib/api/contracts.ts::TripRead`,
  `apps/web/components/paxpivot/Handoff.tsx::HandoffLabel`

## Owned paths

```text
apps/web/lib/presentation/terminal-origin-airports.ts
apps/web/lib/presentation/commercial-flights-link.ts
apps/web/lib/presentation/adapters/commercial-handoff.ts
apps/web/app/trips/[tripId]/CommercialHandoff.tsx
apps/web/app/trips/[tripId]/page.tsx
apps/web/tests/commercial-flights-link.test.ts
apps/web/tests/commercial-handoff.test.tsx
apps/web/tests/screens/results.test.tsx     (add the card to the live-route tests; adapt the
                                              forbidden-wording test's scope — see "Forbidden
                                              wording" below)
README.md                                    (the trip-page description only)
docs/tasks/TASK-053-commercial-handoff.md
```

Not touched: `apps/web/app/trips/[tripId]/TerminalsToCheck.tsx`,
`apps/web/lib/presentation/adapters/terminals-to-check.ts`,
`apps/web/tests/terminals-to-check.test.tsx` (that file renders `TerminalsToCheck` in isolation
and is unaffected by a sibling section), any profile file, `api.py`, or any contract file other
than reading the existing `TripRead` shape.

## Read-only context

```text
PAXPIVOT_PRODUCTION_PRD.md §4.2, §4.3, §16
paxpivot.md COM-001..004, GND-003, PRV-003, §7.3.3, §11.2
docs/architecture/UI_FOUNDATION.md
docs/decisions/ADR-003-ui-foundation.md
docs/tasks/SCREEN_TASK_RULES.md
docs/tasks/TASK-044-terminals-to-check.md
apps/web/lib/api/contracts.ts::TripRead
apps/web/lib/presentation/types.ts::CommercialBaselineView, HandoffUnknownKind
apps/web/components/paxpivot/{CommercialBaselineCard,Handoff,SourceStateBadge}.tsx
apps/web/components/ui/{Card,Facts,ScreenSection,Button,Pill}.tsx
apps/web/lib/presentation/adapters/{format,trips,terminals-to-check}.ts
apps/api/paxpivot/infrastructure/bootstrap.py (seeded terminal names, for the curated airport
  keys — read-only; this task makes no API/schema change)
```

## Interfaces consumed

```text
apps/web/lib/api/contracts.ts::TripRead
apps/web/lib/presentation/adapters/format.ts::formatTimestamp
apps/web/components/paxpivot/Handoff.tsx::HandoffLabel
apps/web/components/ui/{Card,CardHeader,CardActions,Button,FactStrip,ScreenSection}
apps/web/lib/presentation/fact.ts::Fact, known, unknown
```

## Interfaces produced

```text
apps/web/lib/presentation/terminal-origin-airports.ts::originAirportsForTerminal(name) -> readonly string[]
apps/web/lib/presentation/commercial-flights-link.ts::
  GOOGLE_FLIGHTS_BASE_URL, GOOGLE_FLIGHTS_PLAIN_URL
  isoDateOnly(iso) -> string
  buildGoogleFlightsQueryText(input) -> string
  buildGoogleFlightsSearchUrl(input) -> string   (pure; never fetches)
apps/web/lib/presentation/adapters/commercial-handoff.ts::
  CommercialHandoffViewModel, toCommercialHandoffViewModel(trip) -> CommercialHandoffViewModel
apps/web/app/trips/[tripId]/CommercialHandoff.tsx::CommercialHandoff({ model })
```

`CommercialHandoffViewModel` is a page-local composition of existing presentation primitives
(`Fact<T>`, `FactView`, `Href`) — not a new field on any foundation type in
`lib/presentation/types.ts`. `CommercialBaselineView` (the foundation type used once ranked
Space-A/commercial comparison exists, TASK-036) was deliberately not reused: its `headline:
"safest_overall" | "fallback"` is a ranking claim relative to Space-A routes this page does not
have yet, and forcing one would fabricate a ranking. This card instead follows
`CommercialBaselineCard`'s pattern (`Card tone="handoff"`, `HandoffLabel`, `FactStrip`,
`CardActions`) as a screen-local component, exactly as `TerminalsToCheck.tsx` did for TASK-044.

## Design notes / ambiguity resolutions

- **Origin airport keys.** There are no terminal coordinates and no stable client-visible slug
  for a terminal (`terminal_id` is an opaque UUID); `TripRead.origin_terminal_name` is the only
  stable, human-legible key available to the web app. The curated table is keyed by the exact
  terminal `name` string seeded in `apps/api/paxpivot/infrastructure/bootstrap.py`
  (`REFERENCE_TERMINALS`). A terminal renamed later without updating this table falls back to "no
  curated airports" (never a wrong guess) — flagged in Known limitations below.
- **"An origin terminal with no entry gets no prefilled origin, only the plain search."** Read
  literally at the link-builder level: `buildGoogleFlightsQueryText`/`buildGoogleFlightsSearchUrl`
  never fabricate an origin — when `originAirports` is empty the built query has no "from …"
  clause at all (destination, dates and party size only). The card's secondary, always-present
  "plain search" link (COM-004, the base `https://www.google.com/travel/flights` with no query)
  is offered on every trip regardless of curation, not only when the terminal is uncurated. This
  keeps the pure function's contract simple (it always returns a valid, safely encoded URL) and
  still satisfies the sentence: an uncurated terminal's primary link carries no invented origin,
  and the plain link is always there as the fallback the sentence names.
- **Google Flights query grammar.** The natural-language query is
  `Flights to <destination> [from <IATA, IATA, …>] on <YYYY-MM-DD> through <YYYY-MM-DD> for <N>
  traveler(s)`. Dates are taken as the `YYYY-MM-DD` prefix of the trip window's ISO timestamps
  (`isoDateOnly`) rather than through a `Date` object, so the result never shifts under a
  reader's or CI runner's local timezone.

## Acceptance criteria

- [x] The card renders on `/trips/{tripId}` below "Terminals to check", built only from the
      already-loaded `TripRead` (no new API call, no schema change).
- [x] The mandatory `HandoffLabel` text "Live handoff · availability and fare unknown" is present.
- [x] COM-003 caveats are all visible: Google may omit options; the prefill may not match; prices
      may differ from what the traveler pays; a self-transfer needs the traveler's own checking.
- [x] The requested airports, dates and party size are shown as verification facts before the
      traveler opens either link.
- [x] COM-004: a second, always-present plain search link
      (`https://www.google.com/travel/flights`, no query) is offered beside the prefilled one, and
      documented above as the mitigation for undetectable prefill failure.
- [x] COM-002: no fare, price, availability or booking wording anywhere except inside the caveat
      sentences themselves; no currency pattern (`/\$\s?\d/`) anywhere in the card.
- [x] Both links open in a new tab with `rel="noopener noreferrer"`.
- [x] PRV-003: the URL is built by a pure function at render time; nothing is fetched from Google
      and nothing about the destination is logged.
- [x] An origin terminal absent from the curated table yields a query with no origin clause (see
      Design notes) and the "Suggested origin airports" fact reads "Unknown".
- [x] The curated airport list is visibly labelled as a curated suggestion to check, not a
      verified or authoritative list.
- [x] Never "no flights", never a probability/"chance of" phrase, anywhere on the page including
      inside this card.
- [x] The word "flights" appears only inside this commercial section; the terminals-to-check
      section and the rest of the page still ban it (see "Forbidden wording" below).
- [x] 320px layout, axe clean, existing tokens/components only, no new dependency.
- [x] Tests prove every behavior above; `make check` exits 0; `git diff --stat origin/main`
      touches only the files listed under "Owned paths".

## Forbidden wording (why this test changes, and why it does not weaken)

`tests/screens/results.test.tsx`'s "never renders forbidden wording" test previously banned
`/\bflights?\b/i` across the *entire* rendered trip page, because the only content on that page
was the honest Space-A "terminals to check" list. This task legitimately introduces the word
"flights" in a clearly separate commercial section (Google Flights is a proper noun; "commercial
flights" is a paid alternative this pilot honestly names as such per COM-001).

The test is adapted, not weakened: it now extracts the new commercial section's own text (via its
`region` accessible name, "Commercial flight alternative") and excludes only that subtree before
running the `/\bflights?\b/i` check — so the Space-A/terminals side of the page is exactly as
strictly guarded as before, and a stray "flights"/"departures"/"seats" claim leaking into the
terminals list, the trip summary card, or any future Space-A copy on this page still fails the
test. `/\bdepartures?\b/i`, `/\bseats?\b/i`, `"no flights"`, `"probability"` and `"chance of"`
remain banned across the *entire* page, commercial section included — this task's own copy avoids
every one of them. A new assertion confirms "flights" *does* appear inside the commercial section
(proving the allowance is exercised, not merely unused) and confirms it does *not* appear in the
remaining page text.

## Required tests

```text
apps/web/tests/commercial-flights-link.test.ts
  - encodes special characters and unicode in the destination text (round-trips through the
    built URL's own `q` parameter)
  - isoDateOnly extracts YYYY-MM-DD regardless of time-of-day/milliseconds in the ISO string
  - party size renders "1 traveler" (singular) and "N travelers" (plural)
  - the curated airport list matches the four seeded terminals exactly
  - an unrecognized terminal name returns no airports, and the built query has no "from" clause

apps/web/tests/commercial-handoff.test.tsx
  - the mandatory HandoffLabel text is present
  - every COM-003 caveat sentence is present
  - destination, window, party and suggested-airports facts are shown and match the trip
  - the curated-suggestion disclosure sentence is visible
  - both links carry the correct href (prefilled vs. plain) and both carry
    target="_blank" rel="noopener noreferrer"
  - no currency/price pattern (`/\$\s?\d/`) appears anywhere in the rendered card
  - an uncurated origin terminal shows "Unknown" for suggested airports and a query with no
    "from" clause, while the plain link is still offered
  - axe: no violations

apps/web/tests/screens/results.test.tsx
  - the live `/trips/{tripId}` route renders the commercial handoff card below "Terminals to
    check", with the correct prefilled href for the fixture trip
  - the adapted forbidden-wording test (see above): terminals/rest-of-page side still bans
    flights/departures/seats/no flights/probability/chance of; the commercial section is shown to
    contain "flights" and nothing else banned; a planted "no flights" or bare "flight" string in
    the commercial section's own copy would still fail the test (verified by hand during review,
    since deliberately breaking the copy to prove it is not part of the committed suite)
  - axe: no violations with the card present
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

No migration changed, so `make migrate-test` is not required. `make check` aggregates the above
and is recorded in the Handoff section once green.

## UI behaviour (screen tasks only)

See `docs/tasks/SCREEN_TASK_RULES.md`. Specific to this card:

- Responsive: the card is a normal `Card`/`ScreenSection` composition using existing spacing
  tokens; it reflows to one column at 320px and gains no fixed widths on desktop, matching
  `TerminalsToCheck`'s pattern immediately above it.
- Accessibility: a labelled `region` ("Commercial flight alternative") via `ScreenSection`; the
  card itself is an `article` with an `h3` title via `aria-labelledby`; both links are real
  `<a>`/`Button` elements with descriptive text (never "click here"); the caveat list is a `ul`
  with an accessible name; state/labels are always text, never colour alone.
- Loading/empty/error: the card has no loading state of its own (it derives only from the
  already-loaded `TripRead`, which the page has already resolved by this point); there is no
  empty state because every trip has a destination, window and party size; there is no error
  state because the card never performs its own fetch.

## Review / merge rules

`docs/agent/MERGE_POLICY.md` and `docs/tasks/SCREEN_TASK_RULES.md` apply. A fresh engineering
review recording zero Critical/Important findings is required in the PR before merge, per
MERGE_POLICY.md; this PR is opened with a "## Review" section noting that review is pending and
the PR is not to be merged until it is recorded.

## Out of scope

- Not included: API/schema changes, fare lookup, a geocoded/nearest-airport engine, any Space-A
  route card, eligibility, the traveler profile (owned by the parallel TASK-050 and not touched by
  this task).
- Do not refactor: `TerminalsToCheck.tsx`, `terminals-to-check.ts`, `CommercialBaselineCard.tsx`,
  `Handoff.tsx`, or any other foundation-owned file.
- Do not implement TASK-036 (direct opportunities/route cards) or any ranked comparison between
  this card and a Space-A route.

## Pilot validation gate (paxpivot.md §19)

The "40 browser/device canary checks ≥95%" pilot validation gate is a manual owner check and is
**not done** by this task. It is out of scope for an autonomous build agent and must be recorded
separately by the product owner before this feature is treated as pilot-validated.

## Blocked / contract change needed

`None`

## Handoff

Fill this in before review/done.

**Branch:** `build/TASK-053-commercial-handoff`

**Commit:**

**Files changed:**

**Interfaces added/changed:** see "Interfaces produced".

**Migrations:** none.

**Verification run:**

```text
command -> PASS/FAIL summary
```

**Known limitations / risks:** the curated origin-airport table (COM-001) is a manually maintained
approximation with no authoritative source and is keyed to the exact terminal names seeded today;
it must be reviewed by a human and kept in sync if a terminal is renamed or a new terminal is
registered. The pilot validation gate above is not done by this task.

**Next dependency:** none identified; TASK-036 (direct opportunities/route cards) would eventually
need to decide how this card's position/wording changes once ranked Space-A results exist
alongside it.
