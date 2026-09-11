# PaxPivot — Audit: "production ready, fully working" (2026-09-11, main @ 9524eed)

## 1. Executive Summary

**Health grade: B+ for what exists; the product is roughly 40% of the PRD.** Deployed, TLS,
signed in, backed up, with real source data flowing (four official AMC terminal pages checked
every 6 h, immutable observations, honest states). Code quality, tests (234 unit / 36 integration
/ 329 web, all green), constraints and boundaries are strong. What is *not* working is the
planner: Plan → Find routes → Trips → Plan loops through honest empty states because no trip
request, eligibility, parsing, destination, ground or routing logic exists yet. That is PRD
Milestone C onward, gated by explicit product decisions (parser accuracy, policy versions).
Top 3 risks: (1) the loop reads as "broken" to the one user; (2) a parser built without the
labeled corpus the PRD requires would turn page hashes into invented flights; (3) scope: the
remaining milestones are weeks of bounded work, not a run. Top 3 opportunities: (1) remove the
loop today; (2) approve parsing for the four registered pages and build the first parser under
the accuracy gate, which turns "page reachable" into real departures; (3) a trip request +
eligibility v1 for the pilot's own case, the smallest path to a first real route card.

## 2. Repo Map

Unchanged from the previous audit (Next.js 16 web, FastAPI/SQLAlchemy Core/Alembic API,
PostGIS, Firecrawl provider, one `Makefile`, `Quality` CI). New since: `providers/firecrawl.py`,
`check-sources`, four approved sources, VPS deployment at `paxpivot.qcs-cargo.com`.

## 3. Audit Report (what stands between today and "fully working")

- **High · 4×S — Circular navigation on the live app.** `components/screens/plan/PlanScreen.tsx:41`
  sent the empty Plan to `/trips`; `TripsScreen.tsx:59` sends the empty Trips back to `/`. Fact.
  Consequence: the user experiences a dead loop instead of an honest "not available" plus a way
  to something real. Fixed in this run (Plan's empty action now leads to the live Terminals).
- **Critical (product gap) · 5×XL — No schedule parser.** Observations carry status + hash only
  (`infrastructure/providers/firecrawl.py`); `may_parse=False` for every source
  (`infrastructure/bootstrap.py`, `APPROVED_TERMINAL_PAGE_POLICY`). PRD SRC-009 gates automatic
  opportunities on a labeled corpus at ≥ 99 % exact critical fields and zero false opportunities.
  Nothing downstream (opportunities, routes) can exist until this lands. Decision required and
  taken (see §6): parsing is approved for the four registered AMC pages, behind the gate.
- **Critical (product gap) · 5×L — No trip request, traveler profile or eligibility engine.**
  `app/page.tsx` renders `emptyPlan`; no API route accepts a trip; `domain/eligibility.py` has
  contracts but no engine (`application/` has no eligibility module). PRD §8 requires versioned
  policy data.
- **High · 4×L — No destination resolver, origin-terminal finder or ground routing** (PRD §5, §12).
  Terminal cards show travel time as unknown by design (`adapters/terminals.ts`, `NO_TRIP`).
- **High · 4×M — No commercial fallback handoff** (PRD COM-001); `CommercialBaselineCard` exists
  as presentation only.
- **Medium · 3×M — Readiness workflow, alerts and notifications** are presentation-only
  (`emptyProfile`, `emptyAlerts`); PRD §13 notifications need the change-detection layer.
- **Medium · 3×S — Cadence is informational**: `run_source_checks` checks every enabled source
  per invocation (`application/source_checks.py`); cron interval = cadence today.
- **Low — Key hygiene:** the Firecrawl key was pasted into a chat once; rotation pending (owner).
- **Healthy:** architecture, tests, CHECK parity, read-only seams, access boundary, deployment,
  backups, dependency hygiene (no known vulnerabilities).

Strengths to preserve: every live route is honest; observations are immutable; the policy gate
sits in front of every processing step; one command surface; PR-per-task with review records.

## 4. Improvement Strategy (decisions taken by the delegated foundation agent)

1. **No dead ends.** Every empty state's primary action leads to something live. Done signal:
   no live route links to a route that links straight back (test-pinned for Plan).
2. **Parse under the gate, one page first.** Approve `may_parse` for the AMC terminal pages;
   build one source-specific parser (JB MDL first: it is the pilot user's home terminal) with a
   labeled corpus captured through the existing provider (Firecrawl `rawHtml` → corpus files
   under `tests/fixtures/parsers/`, reviewed by a person), an accuracy report, and
   `parser_review_required` until the corpus passes 99 %. Done: `ScheduleObservation` rows for
   one terminal with provenance, visible on the terminal detail as published departures with
   the 72-hour label; never as a reservation.
3. **Pilot-first planner.** Trip request (origin = home, destination, window, party) persisted
   and posted from Plan; eligibility engine v1 for the pilot's own traveler class (a versioned
   policy row, not copy); direct Space-A opportunities from parsed rows; one route card per
   opportunity with the commercial baseline handoff (Google Flights prefill, COM-001). Trade-off:
   no multi-hop, no probability, no OCONUS policy breadth. Done: Plan → Find routes shows real
   direct opportunities for the pilot's home network or an honest absence panel.
4. **Not now:** temporal graph, historical prediction, notifications backend, per-user auth.

## 5. Task Plan

| ID | Title | Effort | Impact | Deps | Execute-now |
|---|---|---|---|---|---|
| QW-1 | Break the Plan → Trips loop; empty Plan leads to live Terminals | S | 4 | — | **done** |
| M2-P1 (TASK-031) | Approve parsing for the four AMC pages; corpus capture command (`capture-corpus`) storing reviewed `rawHtml` samples under `tests/fixtures/parsers/amc-terminal-page/` | M | 5 | — | prepared (task file) |
| M2-P2 (TASK-032) | JB MDL terminal-page parser: `extract_schedule_rows` + critical-field validator + accuracy report; `ScheduleObservation` table/migration; `parser_review_required` until ≥ 99 % | L | 5 | TASK-031 | prepared |
| M2-P3 (TASK-033) | Terminal detail shows parsed departures (72-h label, provenance, never a reservation) | M | 4 | TASK-032 | prepared |
| M2-C1 (TASK-034) | Trip request: domain + table + `POST/GET /api/v1/trips`; Plan posts it; Trips lists it | M | 5 | — | prepared |
| M2-C2 (TASK-035) | Eligibility engine v1: versioned policy rows, pilot traveler class, decision with citations | L | 5 | TASK-034 | prepared |
| M2-C3 (TASK-036) | Direct opportunities + route cards + commercial baseline handoff | L | 5 | TASK-032, 035 | prepared |
| M3 | Destination resolver, ground routing, readiness, alerts, notifications | XL | 4 | C-series | not started |

Quick Wins: QW-1. Top-3 sketches:
- **TASK-031:** `python -m paxpivot.tooling capture-corpus <source_id>` fetches via the existing
  Firecrawl provider path but with `store_raw` explicitly allowed for the corpus command only,
  writes `rawHtml` to a fixture file named by content hash, and records nothing in the DB. A
  person labels critical fields (departure date/time, destination, seat state, roll call) in a
  sibling YAML. Gotcha: the corpus must never be committed without a human label review.
- **TASK-032:** parser is a pure function `parse_terminal_page(html) -> ParsedRows` with a
  version string; the validator refuses rows missing a critical field; the accuracy report
  compares against labels; migration adds `schedule_observations` (append-only, provenance to
  the source observation). Gotcha: a 72-hour PDF linked from the page is a separate source kind.
- **TASK-034:** `TripRequest` domain (origin terminal id, destination text, window, party size),
  table + migration, `POST /api/v1/trips` behind the bearer + session, Plan form (server action)
  → redirect to `/trips/{id}` which renders the honest "no routes yet" until TASK-036.

## 6. Open Questions → decided here (delegated by the product owner)

1. Parsing approval for the four AMC terminal pages: **approved**, behind the SRC-009 gate.
2. Home terminal for the pilot: **Joint Base MDL** (first parser target).
3. Key rotation: owner will rotate the Firecrawl key later (acknowledged).
Still open: destination resolver data source (geocoding provider) and the ground-routing provider
— both need an account/credential the agent cannot create.

## 7. Post-Execution Status

| Task | Status |
|---|---|
| QW-1 loop fix | Done (this branch; deployed after merge) |
| TASK-031…036 | Prepared: task contracts written; no code (each is a bounded build/foundation task) |
| M3 | Not started |
