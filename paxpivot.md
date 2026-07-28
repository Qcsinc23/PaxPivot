# PaxPivot Validation Pilot Product Requirements Document

> **Boundary:** This document authorizes requirements and validation for one bounded pilot. It does not authorize a broad production platform, public schedule publication, booking, provider overage, or unrestricted processing of military movement material.

## 1. Document control and executive summary

| Field | Value |
|---|---|
| Status | Approved requirements baseline for a bounded validation pilot |
| Product owner | PaxPivot product owner |
| Audience | Pilot owner, engineering agents, UI/UX designer, privacy/OPSEC reviewers, and validation reviewers |
| Evidence date | 2026-07-27 UTC |
| Decision posture | Private validation only; source-specific processing and dissemination approval remains a release gate |
| Deployment boundary | Private, single-user web application on the existing Hostinger VPS |
| Recurring-cost boundary | At or below **$25/month including tax**, with an alert at 80% and no automatic overage or recharge |

PaxPivot will test whether a source-aware planner can reduce the burden of planning one honest, end-to-end Space-A journey. The pilot accepts a final destination and travel window, then proposes ranked routes covering private-origin ground access, a plausible official passenger terminal, a current Space-A opportunity only when fresh official evidence supports one, destination ground access, and a best-effort commercial fallback or continuation.

The generalized pilot party is **an eligible Category VI sponsor with an accompanying minor dependent**, traveling from **Northern New Jersey** to **Upstate South Carolina** for **a future three-day weekend**. The party requires two seats. The application must never present Space-A transportation, released seats, timing, provider supply, fares, onward connections, or completion as guaranteed.

The pilot's central promise is:

> **PaxPivot shows what current official sources support, what remains unknown, how the complete journey fits together, and the least-stranding fallback.**

A result that honestly finds no viable Space-A opportunity and hands the user to a complete commercial alternative is successful product behavior. Generic schedule alerts alone are insufficient because they do not establish party eligibility, two-seat compatibility, terminal access, destination utility, the last ground mile, source failure, document readiness, or a fallback if Space-A movement does not occur.

## 2. Problem, opportunity, and product posture

### 2.1 Problem statement

Space-A planning is not a normal flight-search problem:

- A public schedule artifact is an observation, not a flight, reservation, or promise.
- Eligibility and geography depend on the traveler's category and party composition.
- A nominally nearby base may not operate a current passenger terminal or may be impractical to reach.
- Public sources vary by terminal, format, cadence, extractability, and dissemination notice.
- A successful air movement can still leave the traveler far from the final destination.
- Rideshare, taxi, rental-car, parking, gate access, child-seat supply, fares, and commercial inventory remain live provider decisions.
- DoD does not guarantee Space-A transportation or onward/return transportation. [E01]

Today, the traveler must reconcile these facts across policy, terminal pages, schedule artifacts, maps, local transportation pages, and commercial search tools. A simple alert can increase urgency without reducing end-to-end uncertainty.

### 2.2 Opportunity

The validation opportunity is not to claim novel schedule aggregation, demand, boarding probability, or route reliability. It is to test whether one eligible party finds an evidence-backed, complete, and candid route proposal more actionable than checking disconnected sources manually.

### 2.3 Decision posture

- Build and test only the private pilot described here.
- Treat official source truth, visible uncertainty, and honest failure as core product behavior.
- Keep movement-detail processing and dissemination gated source by source.
- Defer public launch, broad audiences, monetization, and multi-user architecture until the pilot passes its validation gates and receives separate authorization.

## 3. Pilot persona and jobs to be done

### 3.1 Persona

The pilot user is an eligible Category VI sponsor traveling with an accompanying minor dependent. The party:

- starts from an exact origin stored privately in Northern New Jersey;
- wants to reach a final destination in Upstate South Carolina during a future three-day weekend;
- needs two seats for any Space-A opportunity;
- values ease and low stranding risk more than nominally low cost;
- must understand document, signup, mark-present, terminal-access, and fallback responsibilities; and
- will confirm arrival or non-arrival directly rather than relying on aircraft tracking.

This is a generalized validation persona, not a claim about any identified person's service, disability, household, or travel plan.

### 3.2 Jobs to be done

1. **When planning before a public schedule window,** help me identify plausible terminals, readiness tasks, strategic evidence, destination ground options, and commercial fallbacks without inventing a future Space-A schedule.
2. **When official near-term evidence appears,** help me understand whether it can support a two-seat, geography-compatible opportunity and how it connects end to end.
3. **When evidence is stale, missing, conflicting, restricted, or unparseable,** tell me exactly what failed and what I must open or verify myself.
4. **When comparing options,** rank them by least stranding risk and explain every tie-breaker.
5. **When I land or do not move as planned,** refresh only the relevant next steps after I confirm my status.
6. **When no viable Space-A opportunity exists,** give me a usable commercial search handoff rather than a dead end.
7. **Throughout the trip,** minimize the personal data retained and never publish or email unapproved movement details.

## 4. Product principles

1. **Source truth over convenience.** Every consequential claim names its source, source time when present, observation time, extraction state, and limitations.
2. **Visible uncertainty.** Unknown is a first-class value. Source failure never becomes “no flights,” and a schedule observation never becomes a reservation.
3. **Complete journey.** A route includes origin access, terminal readiness, air movement evidence, destination access, handoffs, and fallback. PaxPivot must not hide a difficult ground leg.
4. **Least-stranding fallback.** Ranking prefers lower stranding risk before freshness, time, or cost. A commercial-only handoff may outrank a speculative Space-A path.
5. **Privacy and minimization.** Collect only what the pilot needs; keep the precise trip private; do not collect identity documents or medical evidence.
6. **No guarantee language.** Use “observed,” “appears compatible,” “estimate,” “unknown,” and “confirm with provider.” Do not use “confirmed” unless the user or responsible provider supplied that status.
7. **Human-confirmed transitions.** Arrival and non-arrival come from the user. PaxPivot does not track aircraft or infer undisclosed movement.
8. **Policy is versioned evidence.** Eligibility and documentation copy carries the controlling source version/date and must be rechecked before release.

## 5. Pilot hypotheses and evidence state

The evidence-state labels are: **verified fact** (directly supported by a current primary source), **supported inference** (reasoned from cited facts with limits), **assumption** (a pilot rule to test), and **unknown** (not settled by reviewed public evidence).

| ID | Hypothesis | Evidence state at baseline | Pilot test |
|---|---|---|---|
| HYP-01 | Category VI rules permit an accompanying dependent when traveling with the sponsor on allowed segments. | **Verified fact** in current DoD policy; possession/acceptance of the required credentials is not verified. [E01–E04] | Human-reviewed eligibility matrix and readiness confirmation. |
| HYP-02 | A complete, party-aware route is more actionable than a schedule alert alone. | **Assumption**; demand and willingness to pay are unknown. | Top result rated at least 4/5 for actionability in at least 8 of 10 scenario evaluations. |
| HYP-03 | Every plausible current official terminal can be discovered and evaluated automatically from the official directory plus linked official pages. | **Supported inference**; directory/page conflicts and source variability exist. [E03, E05–E10] | Evaluate 100% of directory entries and reconcile closure/conflict signals. |
| HYP-04 | A 90-minute traffic-aware drive cap and six-hour transit-led cap produce a useful origin catchment. | **Assumption**; thresholds are pilot choices, not universal travel rules. | Record candidate dispositions and user usefulness feedback across 10 evaluations. |
| HYP-05 | Firecrawl can support source-health monitoring at pilot cadence on its free tier. | **Supported inference** from current pricing/capabilities; real credit consumption and access variability remain unknown. [E31] | Thirty-day usage and source-health log with budget projection. |
| HYP-06 | Permitted official sources can reach the parser accuracy needed for opportunity creation. | **Unknown** until a labeled corpus and source-specific dissemination review exist. | At least 100 representative pages/artifacts across every enabled layout; zero false opportunities and at least 99% exact critical fields. |
| HYP-07 | An explainable lexicographic ranking produces the least-stranding top result. | **Assumption**; no boarding or completion probability is claimed. | Comparator fixtures plus user reasonableness ratings for all 10 runs. |
| HYP-08 | Best-effort commercial handoffs remain useful without fare ingestion or booking. | **Assumption**; link stability, inventory, and price remain provider-controlled. | Forty browser/device canary tests and user feedback. |
| HYP-09 | Commercial direct-flight data can provide a low-transfer-confidence duration analogue for direct Space-A legs. | **Supported inference** for medium/long commercial analogues, not military performance. [E33] | Preserve provenance now; no accuracy claim until at least 20 user-confirmed direct Space-A completions. |
| HYP-10 | Source-health/readiness email can be reliable without exposing movement details. | **Supported inference** from Resend's event model; inbox delivery remains empirical. [E32] | Twenty controlled sends, webhook replay, and inbox checks. |
| HYP-11 | Historical observations become minimally interpretable after 30 days when denominator and date range are shown. | **Assumption**; this does not establish route frequency or completion probability. | Suppress counts before day 30; inspect every displayed count for sample context. |
| HYP-12 | Public source accessibility does not itself authorize cloud parsing or retransmission. | **Verified fact** as a handling constraint on reviewed notices; source-specific permission remains **unknown**. [E05–E09] | Written source-by-source processing and dissemination register before any movement-row automation. |

## 6. Scope and non-goals

### 6.1 In scope

- One authenticated user and one saved pilot party on the existing Hostinger VPS.
- One generalized CONUS Category VI sponsor-plus-dependent journey.
- Private exact origin, final destination, and travel-window input.
- Full official-terminal discovery and explainable plausibility filtering.
- Firecrawl monitoring of official terminal pages and schedule-link/source-health changes, beginning on the free tier.
- Source-specific parsing only when the notice and review permit cloud processing.
- Current/72-hour, official longer-horizon, and historical/strategic evidence shown separately.
- End-to-end route generation, lexicographic ranking, ground planning, honest no-route behavior, and commercial search handoffs.
- Resend source-health/readiness email only.
- Thirty-day source-health observation, ten scenario evaluations, controlled failure and email tests, user feedback, and budget checks.

### 6.2 Explicit non-goals

- Public launch, a public schedule board, a public movement feed/archive, or public movement-related alerts.
- Active-duty members, retirees, other eligibility categories, unaccompanied dependents, or broad multi-user support.
- OCONUS route generation, multi-Space-A chains, or a universal nationwide production scraper.
- Booking, ticketing, fare ingestion/scraping, fare comparison claims, reservations, or automated Space-A signup.
- Boarding-probability, route-frequency, cancellation-rate, “likely to fly,” market-demand, novelty, or willingness-to-pay claims.
- CAC/login-only, credentialed social, restricted, classified, or otherwise non-public source access.
- Access-control bypass, ADS-B/aircraft tracking, or undisclosed-movement inference.
- Guarantees of transportation, seats, schedules, timing, provider supply, fares, parking, gate access, rental inventory, child seats, or onward connections.
- A universal ±20% Space-A duration or whole-journey ETA claim.
- New hosting spend, automatic provider recharge, or recurring spend above the cap.

## 7. End-to-end user journey

### 7.1 Before a public schedule window

1. The user signs in and confirms the private party profile, exact origin, Category VI attestation, accompanying-dependent status, two-seat need, and readiness checklist.
2. The user enters the final destination and future three-day-weekend travel window.
3. PaxPivot evaluates every current official passenger terminal against directory status, linked official page, exact-origin access, entrance/gate facts, hours, parking, and terminal-readiness needs.
4. The application displays terminal candidates and exclusions with reasons. It does not claim a future Space-A opportunity.
5. Strategic evidence is limited to dated terminal observations. Historical route counts stay hidden until at least 30 observation days exist, then show sample size, denominator, and date range.
6. The application shows destination ground options and best-effort commercial-only handoffs from nearby commercial airports. The commercial-only option ranks ahead of speculative Space-A planning paths.
7. Source-health/readiness email may report a changed, stale, or unreachable source or an incomplete checklist; it contains no movement details.

### 7.2 During a current schedule window

1. PaxPivot checks official source health and distinguishes a successful fresh observation from stale, unreachable, changed-unparsed, missing, or conflicting sources.
2. For an approved-to-process source, a fresh observation may create a Space-A opportunity only when critical fields are exact, the geography is allowed, the travel window matches, and the two-seat state is not contradicted.
3. A restricted or CUI-marked artifact stays user-opened. PaxPivot may show that the official source changed and provide the official link, but it does not upload, parse, retain, transform, or email its movement details without source-specific approval.
4. The application builds complete route proposals and shows a commercial fallback beside each Space-A-dependent route.
5. Ranking compares stranding-risk tier first, then evidence quality, known total time, and known out-of-pocket cost. The UI explains the first field that decided the order.
6. If no source supports a viable opportunity, PaxPivot returns an honest no-route result and lists the sources checked, failed, stale, or awaiting review.

### 7.3 After landing

1. Nothing changes to “arrived” automatically. The user chooses `user_confirmed_arrived` or `user_confirmed_not_arrived`.
2. After user-confirmed arrival, PaxPivot refreshes destination road/transit queries and opens official taxi, rideshare, rental, parking, or prearranged-pickup handoffs as applicable.
3. Every handoff repeats that availability, fare, child-seat supply, hours, and access remain unknown until provider confirmation.
4. PaxPivot opens a best-effort commercial continuation only when requested; it never auto-books or recommends reliance on a nonrefundable pre-arrival connection.

### 7.4 When no viable Space-A opportunity exists

The application says:

> **No viable Space-A opportunity was found in the fresh public sources checked.** This does not mean no movement exists; some sources may be stale, unavailable, restricted, or unparsed.

It then shows checked-source states, a complete commercial-only search handoff, destination ground continuation, known timing, unknown costs/supply, and a visible action for each provider confirmation still required.

## 8. User stories

| ID | User story | Traceable requirements |
|---|---|---|
| US-001 | As the pilot user, I can store the minimum private party and origin details needed to evaluate one trip. | PIL-001, INP-001, PRV-001–PRV-004 |
| US-002 | As the pilot user, I can understand Category VI geography, accompanied-dependent, credential, signup, and mark-present rules without a document-acceptance promise. | ELG-001–ELG-005 |
| US-003 | As the pilot user, I can see every plausible official terminal and why each candidate passed or failed. | TML-001–TML-006 |
| US-004 | As the pilot user, I can distinguish current, longer-horizon, and historical evidence. | SRC-001–SRC-008 |
| US-005 | As the pilot user, I can compare complete routes and understand exactly why one ranks above another. | RTE-001–RTE-009 |
| US-006 | As the pilot user, I can inspect every leg's evidence, timestamp, confidence, unknowns, and required action. | RTE-005, GND-001–GND-005, UX-001–UX-004 |
| US-007 | As the pilot user, I receive an honest explanation and commercial fallback when no viable Space-A opportunity is supported. | RTE-007, COM-001–COM-004 |
| US-008 | As the pilot user, I can open provider handoffs without mistaking them for availability, fares, or bookings. | GND-003–GND-005, COM-001–COM-004 |
| US-009 | As the pilot user, I can control source-health/readiness notifications and see delivery failures. | NTF-001–NTF-006 |
| US-010 | As the pilot user, I control arrival status and any post-arrival refresh. | ARR-001–ARR-003 |
| US-011 | As the pilot user, I can rate actionability, identify missing steps, and record the actual outcome for validation. | VAL-001–VAL-004 |

## 9. Functional requirements

### 9.1 Pilot, input, and eligibility

| ID | Requirement | Verification |
|---|---|---|
| PIL-001 | The pilot shall require authenticated private access, support exactly one user profile, and deploy only to the existing Hostinger VPS after capacity/TLS/backup checks pass. | Attempt unauthenticated access; inspect profile limit and deployment checklist. |
| PIL-002 | Provider configuration shall start on free tiers and prevent automatic overage/recharge. The service shall alert at 80% of the $25 all-in recurring cap and pause the affected feature before projected or actual spend exceeds the cap. | Inject projected and actual spend at 79%, 80%, and above $25. |
| INP-001 | The trip request shall require a final destination and travel window; exact origin, category, accompanying-dependent status, and seat count shall come from the private profile. | Submit missing and complete combinations. |
| INP-002 | The pilot shall accept only the generalized CONUS-to-CONUS use case; other requests shall return “outside pilot scope,” not an eligibility conclusion. | Test every allowed/disallowed segment class and pilot-scope override. |
| ELG-001 | Eligibility logic shall represent the exact Category VI item-47 segment allowlist and version/date it to DoDI 4515.13 Change 7. | Human-reviewed policy matrix passes 100%. |
| ELG-002 | The party shall require the sponsor to accompany the dependent for every Space-A leg and shall require two seats throughout filtering, display, and notifications. | Test unaccompanied and one-seat fixtures. |
| ELG-003 | The full policy matrix shall distinguish CONUS; direct CONUS travel to/from Alaska, Hawaii, Puerto Rico, U.S. Virgin Islands, Guam, and American Samoa subject to the policy's stated conditions; and within Alaska, Hawaii, Puerto Rico, or U.S. Virgin Islands. Unlisted geography shall never be inferred. | Review all matrix edges; verify CNMI and generic OCONUS are not auto-allowed. |
| ELG-004 | Readiness shall show sponsor/dependent credential guidance, remote-signup caveats, signup-age behavior, mark-present requirements, and the lack of a transportation/continuation guarantee with source version/date. | Copy review against E01–E05. |
| ELG-005 | The application shall show the unresolved dependent-document conflict verbatim from Section 15 and require user acknowledgement plus departure-terminal confirmation; it shall never claim an alternative document will be accepted. | Copy snapshot and negative-language tests. |

### 9.2 Terminal discovery and source truth

| ID | Requirement | Verification |
|---|---|---|
| TML-001 | Each discovery run shall enumerate 100% of entries in the current official AMC terminal directory and inspect the linked official terminal/base page. | Compare run manifest with a human-captured directory baseline. |
| TML-002 | A location shall qualify as a current official Terminal only when it appears in the current directory and its official page does not say passenger service ended. A current official page absent from the directory requires manual approval. An airfield or base alone is insufficient. | Test current, closed-conflict, directory-only, and manually approved fixtures. |
| TML-003 | A driving candidate shall require a traffic-aware estimate of no more than 90 minutes from the exact private origin to the verified terminal entrance for the queried departure time. | Boundary tests at 89:59, 90:00, and 90:01; inspect exact points and query time. |
| TML-004 | A transit-led candidate may take no more than six hours and may contain at most one unresolved taxi/rideshare handoff no longer than 45 minutes. The itinerary must be date-specific and compatible with terminal readiness/roll-call timing. | Boundary and unresolved-handoff fixtures. |
| TML-005 | Candidate decisions shall retain raw duration, query time, entrance, route mode, and pass/fail reason. Near-threshold values shall not be rounded into eligibility. | Inspect candidate records and UI at boundaries. |
| TML-006 | Hours, entrance/gate/visitor-center instructions, parking state, required pre-roll-call presence, and last-mile uncertainty shall be visible for every candidate; unknowns are permitted but cannot be hidden. | Candidate completeness audit. |
| SRC-001 | Firecrawl shall monitor every official terminal page for directory/link/health changes at a budgeted baseline cadence and every plausible trip-relevant page at the active-window cadence. Cadence shall be visible and budget forecast before activation. | Inspect monitor registry, cadence, and projected credits. |
| SRC-002 | Every source shall have a processing register containing authority, public URL, notice/marking state, cloud-processing decision, allowed retained fields, retention, UI use, email use, reviewer, and review date. Default is “not approved.” | Attempt processing with missing/denied approval. |
| SRC-003 | Restricted or CUI-marked artifacts shall remain user-opened until source-specific review approves processing. PaxPivot shall not upload, mirror, transform, parse, or retain their movement rows before approval. | Use marked test artifact and inspect provider/storage/log egress. |
| SRC-004 | A Schedule observation shall record source URL, source timestamp when present, observed-at timestamp, retrieval result, content hash, parser state, and confidence reasons. It shall never be labeled a flight. | Schema/UI copy audit. |
| SRC-005 | Current/72-hour observations, official longer-horizon artifacts, and historical/strategic observations shall use separate views and labels and shall never be merged into one confidence claim. | Visual regression and content tests. |
| SRC-006 | Historical route counts shall remain hidden until at least 30 days of observations exist and shall always show observation count, observation denominator, and date range. They shall not be labeled frequency or probability. | Tests at days 29 and 30 and copy review. |
| SRC-007 | Source state shall be exactly distinguishable as `fresh`, `source_stale`, `source_unreachable`, `source_changed_unparsed`, `source_missing`, `source_conflict`, `monitor_delayed`, `no_departures_published`, or `no_compatible_opportunity`. The last two require a successful source observation. | State-machine and visual tests for every state. |
| SRC-008 | Source freshness shall show source age separately from PaxPivot observation age. A current view requires a successful check within 6.5 hours, an artifact whose stated validity covers the requested window, and no source-specific stale condition; absent timestamps/cadence produce “freshness unknown.” | Time-travel tests around freshness thresholds. |
| SRC-009 | Parser output may create an automatic opportunity only after the enabled source's labeled corpus reaches at least 99% exact critical-field accuracy with zero false opportunities; low-confidence changes require human review. | Labeled-corpus report and release-gate test. |

### 9.3 Route generation and ranking

| ID | Requirement | Verification |
|---|---|---|
| RTE-001 | Route generation shall use the private party profile, final destination, travel window, current terminal registry, source health, policy allowlist, ground results, and commercial handoffs. | Trace fixture inputs to route output. |
| RTE-002 | A Space-A opportunity shall require a fresh approved Schedule observation that appears compatible with party geography, window, and two-seat need. It shall be labeled “opportunity,” never reservation, ticket, or confirmed flight. | Positive/negative opportunity fixtures and copy scan. |
| RTE-003 | Numeric released seats below two shall make an observation incompatible. Blank, zero, `T`, `F`, `TBD`, or other nonnumeric/ambiguous seat states shall retain the raw source value and show seat compatibility as unconfirmed; none shall imply boarding probability. | Seat-state matrix. |
| RTE-004 | Geography compatibility shall be checked per Space-A leg against the exact allowlist. Historical evidence alone shall never satisfy current journey compatibility. | Geography and history-only fixtures. |
| RTE-005 | Every viable Route shall include ordered origin ground access, terminal readiness, Space-A or commercial air step, destination ground access, every Handoff, evidence/unknowns, and a commercial fallback. | Route schema completeness must be 100%. |
| RTE-006 | The rank comparator shall be strictly lexicographic: lowest stranding-risk tier; then source authority/freshness/extraction confidence; then lowest total known journey time; then lowest known out-of-pocket cost. No weighted aggregate score is permitted. | Comparator property tests and fixed fixtures. |
| RTE-007 | If no viable Space-A route exists, the product shall return the exact honest no-route behavior in Section 7.4, enumerate checked and failed source states, and show a commercial-only handoff. | No-departure, incompatible, stale, unreachable, and unparsed fixtures. |
| RTE-008 | Unknown duration or cost shall never be treated as zero or “cheaper/faster.” Within otherwise equal routes, complete known values sort ahead of unknown values and the UI explains the limitation. | Unknown-value comparator tests. |
| RTE-009 | A withdrawn or superseded source row shall not remain an active opportunity. Duplicate rows across source revisions shall collapse by source identity and critical fields while preserving revision history. | Revision, withdrawal, and duplicate fixtures. |

### 9.4 Ground, commercial, duration, arrival, and notifications

| ID | Requirement | Verification |
|---|---|---|
| GND-001 | Ground results shall cover driving, public transit, taxi/rideshare handoffs, rental cars, parking, terminal/gate access, and nearby useful scheduled commercial airports. | Route-detail mode coverage audit. |
| GND-002 | A displayed live drive/transit estimate shall use the exact private points, exact travel date/time, and verified entrance and be no more than 15 minutes old at render. Older results shall display stale and require refresh. | Clock and endpoint tests. |
| GND-003 | Every taxi, rideshare, rental, parking, child-seat, gate, and provider-hours result without direct live confirmation shall display `LIVE HANDOFF — availability/fare unknown` or the equivalent full label. | Copy scan across 100% of handoffs. |
| GND-004 | Provider links shall prefill pickup/drop-off where supported, preserve the responsible provider's identity, and give a plain official-link fallback when prefill fails. | Browser/device deep-link tests. |
| GND-005 | PaxPivot shall never infer that a driver may enter an installation, a lot has space, a rental/child seat exists, or a local provider is operating. These shall remain user/provider confirmation tasks. | Negative assertion tests and copy review. |
| COM-001 | Commercial fallback/continuation shall use best-effort prefilled Google Flights plus airline or OTA handoffs only. | Network/data inventory audit. |
| COM-002 | PaxPivot shall not ingest, store, compare, or display fares as PaxPivot facts and shall not book or promise availability. | Storage/UI scan and provider mock. |
| COM-003 | Commercial links shall visibly state that Google may omit options, dates/airports/prefill may fail, price may differ, and self-transfers require separate verification. | Copy review against E30. |
| COM-004 | If a prefilled link fails a canary, PaxPivot shall show a plain provider search link and `prefill failed`; it shall never silently open the wrong date or airport. | Broken and mutated-link tests. |
| DUR-001 | Duration shall be represented as separate airborne analogue, block-time analogue, schedule uncertainty, and whole-journey duration fields. | Route-detail schema/UI audit. |
| DUR-002 | Analogue ranges shall follow Section 14, show provenance and confidence, and be suppressed or widened for stop ambiguity or poor applicability. | Model fixture and copy tests. |
| DUR-003 | Before user-confirmed completion, schedule uncertainty and whole-journey duration may be open-ended. The product shall not show a pre-arrival whole-journey point ETA. | Snapshot/copy tests in all arrival states. |
| ARR-001 | Arrival status shall have only `not_started`, `unconfirmed`, `user_confirmed_arrived`, and `user_confirmed_not_arrived`. | State-transition tests. |
| ARR-002 | Only an explicit user action may enter either `user_confirmed_*` state. No location, ADS-B, schedule, or inferred movement event may do so. | Event-source audit and negative integration tests. |
| ARR-003 | Destination refresh and optional commercial continuation shall occur only after the relevant user confirmation or explicit user request. | Transition and action tests. |
| NTF-001 | Until detailed movement-email handling is approved, Resend email shall contain source-health and readiness information only; no departure point, destination, date/time, seat, route, or movement-row detail. | Message-content allowlist test. |
| NTF-002 | Notification settings shall support enable/disable, source-health categories, readiness categories, quiet hours, and verified recipient address for the one user. | Settings and send-policy tests. |
| NTF-003 | Logical notifications shall deduplicate on event type, source, source revision/hash, and readiness state. A replay or retry shall not create a second user-visible message. | Webhook and job replay tests. |
| NTF-004 | Resend webhooks shall be treated as at-least-once and unordered and deduplicated by provider event ID. | Out-of-order/duplicate webhook tests. |
| NTF-005 | Delivery telemetry shall distinguish queued, sent, delivered, delayed, bounced, failed, and unknown and surface failure in the private app. “Sent” shall not be presented as inbox delivery. | Event-state tests. |
| NTF-006 | Detailed movement email shall remain disabled until a source-specific approval explicitly authorizes exact fields, retention, recipient, and delivery path. | Release-gate test. |

### 9.5 Privacy and validation

| ID | Requirement | Verification |
|---|---|---|
| PRV-001 | The application shall not collect or store SSN, DoD ID number, VA decision letter, disability/medical evidence, full birth date, passport number, or the dependent's medical data. | Form, schema, log, and backup-field audit. |
| PRV-002 | Exact origin, destination, travel window, category attestation, party composition, and outcome shall remain private, encrypted in transit and at rest, and absent from public pages and repository fixtures. | Access, transport, storage, log, and repository scans. |
| PRV-003 | Logs and analytics shall use pseudonymous IDs and shall exclude exact addresses, movement rows, document numbers, email body content, and provider deep-link query payloads. | Log/telemetry sampling. |
| PRV-004 | Retention and deletion shall follow Section 16.4, including immediate user-request deletion and source-specific handling limits. | Time-travel deletion and backup-expiry tests. |
| VAL-001 | The pilot shall maintain a 30-day source-health record and run ten repeated scenario evaluations across two generalized three-day-window variants. | Validation artifact count/date audit. |
| VAL-002 | Each scenario evaluation shall capture top-route actionability (1–5), ranking reasonableness (yes/no), missing step, misleading claim, chosen next action, and actual outcome when known. | Feedback completeness audit. |
| VAL-003 | Failure injection shall cover every state in Section 18.4 and shall never create a positive availability claim. | Automated failure matrix. |
| VAL-004 | The pilot shall stop or pause the affected capability whenever a stop threshold in Section 19 is reached; a merely “functional” screen is not acceptance. | Gate simulation and decision log. |

## 10. Route generation and ranking rules

### 10.1 Candidate pipeline

For each trip request, PaxPivot shall execute this explainable sequence:

1. **Validate pilot and party:** authenticated single user, final destination/window present, two-person accompanied party, and CONUS pilot scope.
2. **Apply policy:** evaluate each possible Space-A segment against the versioned Category VI geography matrix.
3. **Discover terminals:** enumerate the full official directory, reconcile each linked official page, and exclude known ended service or unresolved operational conflict from automatic suggestions.
4. **Resolve entrances:** use a verified passenger-terminal entrance or documented visitor-center/gate point, never an airfield centroid.
5. **Evaluate origin access:** admit candidates that pass either the 90-minute traffic-aware drive rule or the six-hour transit-led/one-handoff rule.
6. **Check operational plausibility:** expose hours, access, parking, readiness/roll-call lead time, and unresolved handoffs.
7. **Evaluate source health:** keep source failures distinct; only fresh, approved, sufficiently accurate observations can create automatic opportunities.
8. **Apply opportunity compatibility:** require matching travel window and geography; enforce two-seat constraints without inferring availability from ambiguous seat codes.
9. **Complete every route:** add origin access, readiness, air step, destination access, provider handoffs, unknowns, and commercial fallback.
10. **Return honest absence:** when no route survives, retain terminal/source evidence and return the no-route state rather than manufacturing a speculative route.

### 10.2 Geography rules

The pilot generates only CONUS-to-CONUS journeys. The underlying policy matrix must nonetheless encode item 47 exactly for testing and must not generalize “territories” beyond named places or direct/within segment classes. A route outside pilot scope is not necessarily legally ineligible; PaxPivot must state only that the pilot does not evaluate it.

### 10.3 Stranding-risk tiers

These are product-defined ordering categories, not probabilities or promises:

| Tier | Meaning | Examples |
|---|---|---|
| 0 — user/provider confirmed | The user has recorded provider confirmation for every non-Space-A leg and the route does not depend on Space-A. | User-recorded commercial itinerary plus confirmed ground transport. PaxPivot did not book it. |
| 1 — commercial-only handoff | A complete commercial-only search path and current ground query exist, but the user must still verify/book with providers. | Google Flights/airline handoff plus ground continuation. |
| 2 — complete current Space-A opportunity | A fresh approved observation supports a direct, party-compatible opportunity and the route includes viable origin/destination access plus an independent commercial fallback. | Two-seat-compatible current observation with no unresolved critical ground step. |
| 3 — current opportunity with unresolved dependency | A current observation exists, but seat state, gate access, provider handoff, or another critical fact remains unresolved. | Ambiguous seat state or unresolved allowed rideshare handoff. |
| Not rankable as viable | Evidence is only historical/speculative, stale, unreachable, conflicting, changed-unparsed, out of scope, or missing a required leg. | Terminal planning card or user-opened restricted source with no approved observation. |

A current Space-A opportunity still confers no reservation or boarding probability. Tier 2 does not mean “safe” or “confirmed.”

### 10.4 Lexicographic comparator

Routes compare one field at a time and stop at the first difference:

1. lower stranding-risk tier;
2. stronger evidence tuple: official primary authority before lower authority; fresh before unknown/stale; exact text or human-reviewed extraction before unreviewed extraction; direct applicability before ambiguous applicability;
3. lower total **known** journey time, with unknown critical time ordered after complete known time;
4. lower **known** out-of-pocket cost, with unknown cost ordered after a complete known cost and never treated as zero.

The comparison UI shall say, for example, “Route A ranks first because it avoids an unconfirmed Space-A dependency; time and cost were not used.” No weighted score, hidden coefficient, boarding model, or frequency proxy is permitted.

## 11. UX information architecture

### 11.1 Navigation

The private pilot shall use five top-level destinations:

1. **Trip** — request, candidates, comparison, and detail.
2. **Readiness** — eligibility/document checklist and acknowledgements.
3. **Sources** — source-health panel, horizons, conflicts, and official links.
4. **Notifications** — source-health/readiness preferences and delivery status.
5. **Feedback** — scenario ratings, outcome, and correction report.

A persistent banner shall state: “Space-A and provider availability are not guaranteed. Verify with the official source/provider.” A privacy indicator shall confirm that the view is private.

### 11.2 Required screens and components

| Screen | Required components and behavior |
|---|---|
| Private onboarding/readiness | Authentication gate; pilot-boundary notice; category attestation without medical evidence; accompanying-dependent and two-seat summary; versioned eligibility geography; document conflict alert; signup/mark-present checklist; acknowledgement/terminal-confirmation task. |
| Trip request | Private exact-origin summary with edit control; final-destination field; travel-window picker; party summary; scope check; cost/privacy notice; generate action. |
| Terminal candidates | Candidate/excluded tabs; map/list; official-status badge; verified entrance; drive/transit result and query time; pass/fail rule; hours/gate/parking/readiness; source-health badge; “why included/excluded” disclosure. |
| Route comparison | Ordered cards; stranding-risk tier; “why this ranks here”; complete leg strip; current/longer/historical evidence labels; known time/cost and unknowns; commercial fallback always visible. |
| Route detail/evidence | Ordered legs; handoff boundaries; source citations/timestamps; raw seat state; authority/freshness/extraction/applicability reasons; duration fields; readiness tasks; official-source action; revision/withdrawal state. |
| Source-health panel | Source registry; last check; source time; observed time; cadence; parser/approval status; fresh/stale/unreachable/changed-unparsed/missing/conflict/monitor-delayed states; official link; no movement-row reproduction for unapproved sources. |
| Ground handoffs | Mode cards for driving, transit, taxi/rideshare, rental, parking, gate/access, and nearby commercial airports; live/stale timestamp; prefilled provider action; prominent unknown supply/fare/child-seat/access label. |
| Commercial fallback | Google Flights search handoff; airline/OTA fallbacks; requested airports/dates/party summary for user verification; no displayed PaxPivot fare; prefill-failed state; provider disclaimer. |
| Notification settings | Verified recipient; categories; quiet hours; enabled state; movement-detail lock; recent delivery telemetry; retry/deduplication status. |
| Validation feedback | 1–5 actionability rating; ranking-reasonable choice; missing/misleading fields; intended action; user-confirmed outcome/arrival status; correction request; privacy reminder. |

### 11.3 Required view states

| State | Required user-facing treatment | Forbidden treatment |
|---|---|---|
| Empty | Explain required input or that no observations have accumulated; provide the next action. | Blank panel or “no flights.” |
| Loading | Show which sources/ground queries are pending and preserve the previous timestamped result as stale if available. | Spinner that hides source identity indefinitely. |
| Stale | Show source and observed ages, stale reason, last success, and refresh/open-source actions. | Current opportunity or “none scheduled.” |
| Unreachable | Say the source could not be reached, identify check time/error class, and link the official source when safe. | “No departures.” |
| Changed-unparsed | Say content changed but could not be interpreted; suppress automatic opportunity and request review/user-opened source. | Reusing prior rows as current without warning. |
| Conflict | Show both official claims, their dates, and automatic inclusion hold. | Silently choosing the convenient source. |
| No departures published | Only after a fresh successful parse explicitly states no departures; name source and validity window. | Generalize to terminals not successfully checked. |
| No compatible opportunity | Explain which fresh observations were incompatible by geography, party, seats, or window. | “No flights exist.” |
| Missing | Show that a formerly known page/artifact disappeared and when it was last seen. | Treat disappearance as “no change.” |
| Monitor delayed | Show expected versus actual check time and preserve last result as stale. | Claim fresh evidence. |
| Prefill failed | Show a plain provider search and the values the user must re-enter/verify. | Open an incorrect search silently. |
| No viable route | Use Section 7.4 copy, source ledger, unresolved facts, and commercial-only handoff. | Dead end or speculative positive route. |

## 12. Canonical glossary and domain model

| Term | Canonical product definition |
|---|---|
| **Terminal** | A currently verified official passenger-service location with a specific official source and entrance. It is not merely an airfield or base. |
| **Schedule observation** | A timestamped record of what an official source showed, together with retrieval and interpretation status. It is not a flight, reservation, or promise. |
| **Space-A opportunity** | A fresh approved Schedule observation that appears compatible with the party, requested window, seats, and geography. It gives no reservation, boarding probability, or completion guarantee. |
| **Route** | A ranked, ordered end-to-end proposal from the private origin to the final destination containing every Leg, Handoff, evidence item, unknown, and fallback. |
| **Leg** | One movement between named points by one mode, with its own timing, cost, source, and confidence state. |
| **Handoff** | An action that transfers the user to a provider to verify live availability, fare, terms, and possibly transact. PaxPivot neither guarantees nor completes the transaction. |
| **Source freshness** | The age and validity of source evidence, using the source's own timestamp when available and PaxPivot's observation time separately. |
| **Confidence** | An explainable assessment of source authority, freshness, extraction quality, and applicability. It is never a probability of boarding or completion. |
| **Arrival status** | The user's stated journey transition: not started, unconfirmed, user-confirmed arrived, or user-confirmed not arrived. It is never inferred from aircraft data. |

Relationships are simple: a Terminal has many Schedule observations; an approved fresh Schedule observation may support zero or more Space-A opportunities; a Route contains ordered Legs and Handoffs; each evidence-backed item has Source freshness and Confidence; Arrival status controls post-arrival actions.

## 13. Data and source requirements

| Provider/source boundary | PaxPivot may use | PaxPivot must not claim or do |
|---|---|---|
| AMC/DoD [E01–E10] | Versioned eligibility/geography/document guidance; official terminal directory/pages; permitted public source metadata and approved observations. | No reservation, boarding probability, future schedule, continuation duty, or processing beyond a source's approved dissemination path. |
| Firecrawl [E31] | Retrieval/monitoring layer for public official page/link health; source-specific parsing when approved; free tier first. | No access bypass, CAC/login source, unapproved restricted/CUI upload, automatic paid recharge, or inference that retrieval failure means no movement. |
| Road/transit data [E22–E27] | Traffic-aware driving, date-specific transit, distances, official agency feeds/links, timestamps, and provider attribution under applicable terms. | No future traffic/transit guarantee; no use beyond licensing/caching terms; no centroid/generic-airfield result for final candidate decisions. |
| FAA/airport metadata [E13–E14] | Airport identity, coordinates, use/ownership baseline, current cycle date, and commercial-service baseline combined with current official airport pages. | FAA metadata alone does not prove a current passenger terminal, scheduled airline service, route, fare, or future utility. |
| Rideshare/taxi/rental/parking [E19–E20, E28–E29] | Official provider lists, deep links, contact instructions, and timestamped official parking facts. | No live supply, fare, inventory, operating-hours, child-seat, installation-entry, or parking-space guarantee. |
| Google Flights/airline/OTA [E30] | Best-effort prefilled search and provider handoff. | No fare ingestion/storage, complete market coverage claim, booking, inventory promise, or silent wrong-search fallback. |
| Resend [E32] | Private source-health/readiness email and delivery telemetry within free limits. | No unapproved movement detail, public alerts, or treating sent as delivered. |
| User confirmation | Party attestation, provider-confirmed state, readiness, arrival/non-arrival, outcome, and ratings. | No conversion of user statements into claims about general boarding probability, frequency, or demand. |

Every external record used in a decision must preserve provider identity, public URL, access/observation time, source time when available, applicable terms/notice state, and confidence reasons.

## 14. Duration estimation and confidence

### 14.1 Required fields

1. **Airborne analogue:** wheels-off to wheels-on estimate derived from completed scheduled commercial nonstop data.
2. **Block-time analogue:** gate departure to gate arrival/unloading-area estimate derived from the same commercial class.
3. **Schedule uncertainty:** uncertainty between an observed roll-call/schedule state and actual departure; it may be open-ended.
4. **Whole-journey duration:** origin ground access, terminal readiness/wait, actual air outcome, and destination access; before completion it may be unbounded.

A roll-call time is not a takeoff time. A distance is not a completion estimate.

### 14.2 Initial analogue

For a possible direct leg:

1. Resolve airports from the current FAA NASR cycle and calculate great-circle distance; record the cycle date. [E13]
2. Compute transparent commercial points from completed domestic nonstop flights:
   - airborne minutes: `18.575 + 0.117193 × distance_miles`;
   - block minutes: `45.465 + 0.117964 × distance_miles`.
3. Form ranges from held-out residuals, not a universal percentage. For 300–999-mile commercial legs, the observed 10th/90th residuals were about −10.8/+9.7 minutes airborne and −20.1/+17.4 minutes block; broader 2.5th/97.5th residuals were about −21.0/+14.6 and −40.1/+23.3. [E33]
4. Label all output `commercial analogue — low confidence for Space-A` and show source/data period.
5. Widen or suppress ranges for legs under 300 miles, an implied stop, ambiguous endpoints, non-direct routing, or unknown applicability. Do not infer aircraft type.

The model used 592,256 completed commercial nonstop flights for training and 604,346 for holdout testing. In the holdout, ±20% contained 94.45% of airborne but only 86.17% of block durations overall; for legs under 300 miles it contained only 79.15% airborne and 62.52% block. The dataset excludes military missions and conditions on completed, nondiverted scheduled commercial flights. It therefore cannot validate Space-A schedules, ground time, stops, cancellations, or completion. [E33]

### 14.3 Confidence

Confidence shall expose four reasons before a high/medium/low/unknown label:

- **authority:** official primary, official derived, vendor, or unsupported;
- **freshness:** source age and observation age separately;
- **extraction:** exact text, reviewed OCR, unreviewed OCR, or failed;
- **applicability:** direct completed analogue, possible direct, stop ambiguity, or incompatible.

Confidence is not a chance of boarding or arrival.

### 14.4 Post-pilot claim gate

PaxPivot shall make no Space-A duration-accuracy claim until at least **20 consented, user-confirmed direct completed Space-A legs** exist. At that point:

- at least 90% of actual airborne durations must fall within displayed airborne ranges;
- at least 90% of actual block durations must fall within displayed block ranges;
- sample size and Wilson interval must accompany results; and
- as a secondary diagnostic only, at least 80% of direct-airborne point estimates should fall within ±20%.

Canceled, no-seat, diverted, and not-completed attempts are not duration successes and must remain in whole-journey reliability reporting. Failure to reach `n ≥ 20` means “insufficient evidence,” not model success or failure.

## 15. Eligibility, dependent, and documentation requirements

### 15.1 Controlling rule

DoDI 4515.13 Table 3 item 47 places authorized veterans with a permanent service-connected disability rated as total in Category VI and permits dependents when accompanied by the sponsor on the listed geography. [E01, E02] This statement defines the general rule; the pilot stores only a Category VI attestation and does not collect a rating, medical record, decision letter, or credential number.

The dependent must remain accompanied by the sponsor, and the route requires two seats. Space-A has no reservation or transportation guarantee; the traveler remains responsible for commercial transportation, lodging, and continuation costs. [E01]

### 15.2 Unresolved document conflict

The Category VI-specific section of DoDI 4515.13 calls for a sponsor USID and accompanying dependent USID showing `100% DAV`. AMC's general guidance also describes an alternative-document path for a child younger than 14 when no DoD ID has been issued, using specified government-issued age/relationship evidence. Current terminal guidance also publishes under-14 alternatives, while cautioning that a hospital birth certificate is not acceptable. The public text reviewed does not establish that the general alternative overrides the Category VI-specific credential language. [E01, E04, E05, E09]

The required UI copy is:

> **Dependent document conflict:** DoDI's Category VI section calls for both sponsor and dependent `100% DAV` USID credentials. AMC also publishes an under-14 alternative-document path. PaxPivot cannot confirm that the alternative applies to an accompanying Category VI minor dependent. Confirm the exact documents with the departure terminal before travel. An alternative document is not guaranteed to be accepted.

The user must acknowledge this warning and record terminal confirmation status as `not_checked`, `requested`, or `user_confirmed`. PaxPivot shall not record document images, numbers, or terminal staff personal information.

## 16. Privacy, security, dissemination, and OPSEC

### 16.1 Access and minimization

- Private authenticated access only; no indexing, public share links, or public trip pages.
- TLS in transit, encrypted sensitive storage, least-privilege service credentials, secret rotation, and tested backups before pilot use.
- Collect only exact origin, final destination, travel window, Category VI attestation, accompanying-dependent/two-seat status, readiness choices, notification address, user-confirmed provider/arrival state, and validation feedback.
- Never collect SSN, DoD ID number, credential images/numbers, VA decision letter, disability/medical evidence, full birth date, passport number, or dependent medical data.
- Logs, analytics, support artifacts, tests, and public repository content must contain no precise personal journey details or movement rows.

### 16.2 Source and dissemination boundary

Public accessibility is not permission to retransmit or cloud-process every artifact. The source-processing register in SRC-002 is mandatory. Until a source-specific review approves otherwise:

- monitor only official page, link, timestamp, hash, and health changes;
- keep restricted or CUI-marked artifacts user-opened;
- do not upload, mirror, transform, parse, or retain movement rows;
- do not place movement details in Resend, logs, analytics, or public content; and
- provide the official source link and an honest “changed/needs review” state.

PaxPivot shall never access CAC/login-only material, automate credentialed social sources, bypass access controls, use restricted/non-public endpoints, create a public movement feed/archive, use ADS-B or other aircraft tracking, or infer undisclosed movement.

### 16.3 Security and incident behavior

- Provider credentials shall be server-side, scoped to the minimum capability, and absent from the client and repository.
- Failed authorization, unusual source access, accidental sensitive logging, or unapproved artifact egress shall disable the affected integration and create a private incident record without copying the sensitive payload.
- Backups and restore tests shall honor the same access and deletion controls.
- No production-like public telemetry or third-party session replay may capture trip fields.

### 16.4 Retention

These are pilot minimization limits and may be shortened by source-specific review:

| Data | Maximum retention |
|---|---|
| Exact profile/trip and user-confirmed outcome | While the pilot is active; delete within 7 days of pilot close or a user deletion request. |
| Source-health metadata without movement rows | 90 days, to support the 30-day observation and audit. |
| Approved schedule observations | No longer than 90 days and only when the source-specific register explicitly permits the retained fields; otherwise zero retention. |
| Restricted/CUI artifact or unapproved movement row | Zero collection and zero retention. |
| Notification event metadata | 30 days, aligned to pilot delivery review; no email body retention in application logs. |
| Validation ratings stripped of trip specifics | 90 days after pilot close, then delete or separately reauthorize. |
| Backup remnants | Expire within 30 additional days after primary deletion and remain inaccessible to normal application use. |

The user can trigger deletion at any time. Deletion completion, backup-expiry deadline, and any provider-retained metadata shall be visible in a private audit record.

## 17. Notification requirements

### 17.1 Allowed content before movement-email approval

Allowed: source name, health state, observed time, “official source changed,” “source could not be reached,” “review official source in the private app,” readiness task name, checklist state, and delivery/support information.

Forbidden: departure or destination, route, date/time, seat information, roll-call information, movement row, attachment/mirror, inferred journey, or provider handoff itinerary.

### 17.2 Trigger and deduplication rules

- Notify only on a state transition, material source revision/hash change, readiness deadline/state change, or explicit test send.
- Use one logical key: `recipient + event_type + source_or_task + revision_or_state`.
- Suppress repeated events with the same logical key; update the in-app event instead.
- Treat Resend webhook events as unordered and at-least-once; deduplicate provider events by event ID.
- Rate-limit retries and quiet-hour release so they do not create duplicate user-visible messages.

### 17.3 Delivery telemetry

The app shall display queued, sent, delivered, delayed, bounced, failed, or unknown with provider event time and last update. Delivery is successful only on `delivered`; inbox observation is a separate validation measure. A bounce/failure disables repeated sends until the recipient is corrected or explicitly re-enabled.

## 18. Validation plan

### 18.1 Scenario and period

Use the generalized party and journey in Section 3. Run a 30-consecutive-day observation. Execute ten route evaluations: five for each of two three-day-window variants within the same generalized future-weekend scenario. Keep exact private inputs and results outside public artifacts.

### 18.2 Source-health validation

For every official terminal page, record budgeted baseline checks for directory/page/link status. For every terminal that passes plausibility during an active window, target four checks per day while staying within Firecrawl's free allocation and the cost cap. Record scheduled/actual time, result, HTTP/error class, source timestamp, hash, artifact-link state, parser/approval state, credits, and detection latency.

Pass requires at least 95% scheduled-check completion per supported trip-relevant source and p95 material-change detection within 6.5 hours. Below 90% check success, unrecognized staleness more than 12 hours beyond source policy, or any failure rendered as no departures stops automatic opportunity use for that source.

### 18.3 Repeated route evaluations and ratings

Each evaluation records:

- all terminal inclusion/exclusion reasons;
- checked source states and evidence horizons;
- route completeness and ordered comparator fields;
- live-ground query age;
- every unknown/provider confirmation task;
- commercial-link behavior;
- actionability rating from 1 (not usable) to 5 (ready to act with stated confirmations);
- ranking reasonableness, missing step, misleading claim, and chosen next action; and
- user-confirmed outcome when available.

Pass requires at least 4/5 actionability in 8 of 10 runs. Fewer than 6 actionable runs after one iteration is a stop signal for route-experience expansion.

### 18.4 Failure injection

Inject and visually inspect: explicit no departures; no compatible opportunity; HTTP 403; DNS/proxy/access failure; stale source; missing artifact; malformed PDF; changed layout; changed-unparsed content; directory/page conflict; duplicate/withdrawn row; ambiguous seat state; timezone/midnight boundary; unavailable transit; entrance/gate uncertainty; full/unknown parking; no rideshare; no rental/child seat; broken commercial prefill; delayed/bounced email; duplicate/out-of-order webhook; budget at 80%; and projected spend above $25.

Every failure must remain visible, preserve the last known timestamped evidence when safe, and avoid a positive availability claim.

### 18.5 Email tests

Send 20 controlled source-health/readiness messages. Require 20/20 accepted by Resend, at least 19/20 delivered events within two minutes, at least 19/20 observed in the pilot inbox, zero duplicate user-visible messages after webhook/job replay, and visible in-app handling for delayed/bounced/failed events.

### 18.6 Budget tests

Before enabling each cadence/integration, forecast monthly credits/calls and invoice including tax and mandatory add-ons. Compare weekly projection and actuals. Alert at 80%; verify auto-recharge/overage is disabled; pause the integration before a projection or invoice exceeds $25.

## 19. Acceptance, pass, and stop criteria

“Functional” is not a metric. Pilot acceptance requires the measurable outcomes below.

| Area | Requirement IDs | Measure | Pass threshold | Stop/pause threshold |
|---|---|---|---|---|
| Eligibility | ELG-001–ELG-004 | Human-reviewed item-47 segment/party matrix and visible source version/date | 100% correct | Any out-of-rule route, unaccompanied-dependent route, or missing policy version |
| Dependent document copy | ELG-005 | Both official rules, conflict, acknowledgement, and terminal-confirmation status | 100% required copy present; zero substitute guarantees | Any birth certificate, passport, VHIC, or other alternative represented as guaranteed Category VI acceptance |
| Terminal discovery | TML-001–TML-006 | Directory recall, linked-page reconciliation, entrance-specific access, and candidate reasons | 100% directory entries evaluated; every passing candidate shown; zero known-ended terminals suggested | Silent inclusion of an unresolved closure conflict or centroid/rounded result used as final pass |
| Source correctness | SRC-004, SRC-009, RTE-002 | Human labels on at least 100 representative pages/artifacts across all enabled layouts | At least 99% exact critical fields and zero false opportunity alerts | One unreviewed false date, time, origin, destination, or opportunity alert |
| Source health | SRC-001, SRC-007, SRC-008 | 30-day check record per supported source | At least 95% scheduled checks complete; p95 change detection at most 6.5 hours | Below 90% success, stale beyond policy by more than 12 hours without warning, or source error shown as no movement |
| Dissemination | SRC-002, SRC-003, NTF-001, NTF-006 | Source-by-source written processing/retention/UI/email register and egress tests | 100% enabled fields explicitly approved; unapproved sources user-opened only | Any warning/CUI material processed, retained, transformed, or emailed outside approval |
| Route completeness | RTE-001–RTE-005 | Required-leg/evidence schema audit | 100% viable routes include origin, readiness, air, destination, handoffs, fallback, evidence, and unknowns | Any omitted long ground leg, readiness step, two-seat constraint, or fallback |
| Route usefulness | VAL-001, VAL-002 | Ten user-rated repeated evaluations | Rating at least 4/5 in at least 8/10 | Fewer than 6/10 actionable after one product iteration |
| Ranking | RTE-006, RTE-008 | Fixed and property-based comparator fixtures plus visible explanation | 100% honor risk → evidence → known time → known cost; 10/10 show decisive reason | Opaque weighted score, unknown treated as zero, or later factor overrides earlier factor |
| Ground freshness | TML-003–TML-005, GND-002 | Rendered query timestamp, exact points/date, verified entrance | 100% current labels are at most 15 minutes old and use exact private endpoints | Stale/centroid/airfield-coordinate route shown as current final decision |
| Handoff honesty | GND-003–GND-005 | All provider result copy and mocks | 100% unconfirmed fare/supply/parking/access/child-seat fields say unknown/live handoff | Any provider availability, fare, inventory, gate entry, or child seat presented as guaranteed |
| Duration | DUR-001–DUR-003 | Field/copy audit now; direct-completion coverage after claim gate | Pilot: zero prohibited point ETA/guarantee and 100% provenance; post-gate: n≥20 and at least 90% airborne/block range coverage | Universal ±20%/Space-A ETA claim, hidden applicability, or incomplete attempts removed from reliability reporting |
| Arrival provenance | ARR-001–ARR-003 | Transition event-source audit | 100% arrived/not-arrived transitions initiated by user | Any aircraft/location/schedule inference changes arrival state |
| Commercial links | COM-001–COM-004 | 40 browser/device canary tests | At least 95% retain requested airports/dates/party or visibly fall back | Silent wrong date/airport or a fare displayed as PaxPivot fact |
| Email | NTF-001–NTF-005 | Twenty controlled sends plus replay | 20/20 accepted; at least 19/20 delivered ≤2 minutes and inbox-observed; zero duplicates | Duplicate message, hidden failure, or movement detail before approval |
| Cost | PIL-002 | Weekly projected and actual recurring total including tax | At most $25; alert at 80%; zero auto-recharge | Any projected/actual amount above $25 or provider auto-overage enabled |
| Failure behavior | SRC-007, RTE-007, VAL-003 | Full Section 18.4 injected matrix | 100% distinct visible states; zero false positives; last evidence timestamp preserved where safe | Any failure disappears, becomes “no flights,” or produces availability |

## 20. Risks, mitigations, dependencies, and deferred decisions

### 20.1 Risks and mitigations

| Risk | Consequence | Mitigation / gate |
|---|---|---|
| Public artifact has restrictive notice or CUI marking | Unauthorized cloud processing, retention, or dissemination | Default-deny processing register; metadata/link monitoring only; user-opened artifact; no movement email. |
| Official page is inaccessible, stale, dynamic, or changed | False absence or outdated route | Explicit source states, last-success timestamp, multi-observation history, no opportunity from failed source. |
| Parser changes date/time/destination/seat meaning | False high-impact opportunity | Per-layout labeled corpus, ≥99% critical accuracy, zero false opportunities, review low-confidence changes. |
| Directory and terminal page disagree | Closed/non-operating terminal suggested | Reconcile both; conflicts block automatic inclusion and remain visible. |
| Category VI dependent documents are interpreted incorrectly | Party arrives without accepted documents | Preserve conflict, no substitute promise, require direct terminal confirmation. |
| Ground route appears feasible but gate/provider access fails | Missed roll call or stranding | Verified entrance, explicit gate/visitor-center state, live query, unresolved-handoff limits, provider confirmation tasks. |
| Commercial prefill or coverage fails | Wrong or incomplete fallback | Canary tests, visible input summary, plain airline/OTA fallback, no fare claim. |
| Duration analogue is over-trusted | False itinerary confidence | Separate fields, low Space-A transfer confidence, no whole-journey ETA, n≥20 claim gate. |
| Notification duplicates or leaks detail | Confusion or dissemination breach | Content allowlist, logical/provider dedupe, event telemetry, movement-detail hard lock. |
| Free-tier usage or taxes exceed cap | Unauthorized spend or monitoring gap | Forecast, 80% alert, no auto-recharge, feature pause before $25. |
| Single-user VPS is not ready | Privacy, reliability, or data-loss risk | Confirm capacity, TLS, outbound email/webhooks, cron reliability, backups, restore, and access control before deployment. |
| One-user results are overgeneralized | Invalid product/market claim | Report only pilot observations; no novelty, demand, frequency, or population inference. |

### 20.2 External dependencies and unresolved confirmations

1. Written source-by-source determination for Firecrawl processing, retained fields, and any future movement-detail email.
2. Authorized confirmation of how candidate terminals apply under-14 alternative-document guidance to a Category VI accompanying dependent.
3. Exact terminal entrance, gate/visitor-center, driver access, parking, and operating-hour facts for each passing candidate.
4. Hostinger spare capacity, TLS, backup/restore, scheduled-job reliability, and outbound webhook/email capability at no incremental cost.
5. Google Routes billing setup, hard quotas, attribution, caching/retention compliance, and active-window transit coverage.
6. Firecrawl actual credit use, source access variability, retention configuration, and no-overage controls.
7. Resend domain verification, webhook security, one-recipient deliverability, and retention behavior.
8. Google Flights/airline/OTA link behavior across the supported browsers/devices.
9. Policy and official-terminal recheck immediately before any pilot release.

An unresolved external confirmation must render as unknown, hold the affected automation, or produce no viable route. It must not be smoothed into an assumption.

### 20.3 Decisions deferred beyond the pilot

- Public launch, public waitlist expansion, schedule alerts, or movement-related publication.
- Active-duty, retiree, other-category, multi-user, or household support.
- OCONUS, multi-hop Space-A, nationwide production coverage, or mobile applications.
- Paid plans, market positioning, demand forecasts, or willingness-to-pay tests.
- Fare APIs, booking, ticketing, automated signup, provider inventory, or commercial transaction support.
- Detailed movement email or other notification channels.
- Aircraft tracking or any automatic arrival source; these remain prohibited, not merely deferred.
- Production reliability, boarding, route-frequency, or duration claims.
- Recurring spend above $25 or new hosting spend.

## Appendix A. Evidence ledger

All sources were accessed **2026-07-27 UTC**. Publication/update dates are those exposed by the source; “not shown” is retained rather than guessed. Confidence applies only to the use described in this PRD. Public schedule rows are intentionally not reproduced.

| ID | Primary source | Publication/update date | Confidence and use |
|---|---|---|---|
| E01 | U.S. Department of Defense, [DoDI 4515.13, Air Transportation Eligibility](https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/451513p.pdf) | 2016-01-22; Change 7 dated 2024-01-11 | **High** — controlling public eligibility, geography, accompaniment, credential, and no-guarantee rules; recheck before release. |
| E02 | Office of the Law Revision Counsel, [10 U.S.C. §2641b](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title10-section2641b&num=0&edition=prelim) | Laws in effect through 2026-07-26 | **High** — statutory eligibility class. |
| E03 | Air Mobility Command, [AMC Space Available Travel Page and terminal directory](https://www.amc.af.mil/AMC-Travel-Site/AMC-Space-Available-Travel-Page/) | Page date not shown | **High** — current directory and guidance; directory status alone is insufficient. |
| E04 | Air Mobility Command, [Frequently Asked Questions](https://www.amc.af.mil/AMC-Travel-Site/Frequently-Asked-Questions/) | Page date not shown | **High** — current public signup and dependent-document guidance; conflict with Category VI-specific language retained. |
| E05 | Air Mobility Command, [Joint Base MDL Passenger Terminal](https://www.amc.af.mil/AMC-Travel-Site/Terminals/CONUS-Terminals/Joint-Base-MDL-Passenger-Terminal/) | Official page exposed current source material dated 2026-07-25 at access | **High** — terminal, ground/document guidance, and source-health evidence; access path has varied. |
| E06 | Air Mobility Command, [BWI Passenger Terminal](https://www.amc.af.mil/AMC-Travel-Site/Terminals/CONUS-Terminals/Baltimore-Washington-International-Airport-Passenger-Terminal/) | Current source material dated 2026-07-27 at access | **High** — terminal, source horizons, and signup privacy warnings. |
| E07 | Air Mobility Command, [Dover AFB Passenger Terminal](https://www.amc.af.mil/AMC-Travel-Site/Terminals/CONUS-Terminals/Dover-AFB-Passenger-Terminal/) | Page date not shown; current linked artifact at access | **High** — source/cadence evidence; internal cadence wording conflict retained. |
| E08 | Air Mobility Command, [Joint Base Andrews Passenger Terminal](https://www.amc.af.mil/AMC-Travel-Site/Terminals/CONUS-Terminals/Joint-Base-Andrews-Passenger-Terminal/) | Current source material dated 2026-07-26 at access | **High** — terminal, source, access, and parking evidence. |
| E09 | Air Mobility Command, [Joint Base Charleston Passenger Terminal](https://www.amc.af.mil/AMC-Travel-Site/Terminals/CONUS-Terminals/Joint-Base-Charleston-Passenger-Terminal/) | Current source material dated 2026-07-27 at access | **High** — terminal, source, document, and dissemination-notice evidence. |
| E10 | Robins Air Force Base, [Passenger Terminal](https://www.robins.af.mil/Units/78th-Air-Base-Wing/78th-Mission-Support-Group/Passenger-Terminal/) | Page date not shown | **High** — current ended-service statement that conflicts with directory listing. |
| E13 | Federal Aviation Administration, [28-Day NASR Subscription, 2026-07-09 cycle](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/2026-07-09) | Effective 2026-07-09 | **High** — airport identity/coordinates; does not prove terminal or scheduled service. |
| E14 | Federal Aviation Administration, [CY2024 Commercial Service Enplanements](https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger/arp-cy2024-commercial-service-enplanements.pdf) | Published 2025-09-15; CY2024 data | **High** — lagging commercial-service baseline. |
| E19 | GSP Airport District, [Ground transportation](https://gspairport.com/ground-transportation/) | Page date not shown | **High** — official provider/mode surface; supply and price remain unknown. |
| E20 | GSP Airport District, [Parking](https://gspairport.com/parking/) | Page date not shown; live/dynamic at access | **High** — official parking surface; price and occupancy remain volatile. |
| E22 | Google Maps Platform, [Routes API](https://developers.google.com/maps/documentation/routes), [transit routes](https://developers.google.com/maps/documentation/routes/transit-route), [policies](https://developers.google.com/maps/documentation/routes/policies), and [pricing](https://mapsplatform.google.com/pricing/) | Main documentation 2026-05-21; transit/policies 2026-07-20; pricing date not shown | **High** for capability/terms/current thresholds; **medium** for future invoice stability. |
| E23 | NJ Transit, [Developer terms](https://developer.njtransit.com/terms/) | Date not shown | **High** — official feed conditions and caveats. |
| E24 | Maryland Transit Administration, [Developer resources](https://www.mta.maryland.gov/developer-resources) | Page date not shown | **High** — official GTFS/GTFS-realtime resources and caveats. |
| E25 | WMATA, [Developer resources](https://www.wmata.com/about/developers.html) and [transit data terms](https://developer.wmata.com/license) | ©2026; effective date not shown | **High** — official data capability and license boundary. |
| E26 | Amtrak, [BWI station](https://www.amtrak.com/stations/bwi), and BWI Airport, [courtesy shuttles](https://bwiairport.com/to-from-bwi/transportation/shuttles/bwi-courtesy-shuttles/) | 2026 copyright/page date not shown | **High** — station/airport connection facts; future itinerary unknown. |
| E27 | Delaware Transit Corporation, [DART Route 105](https://www.dartfirststate.com/RiderInfo/Routes/htmls/winter/rt105.html) | Current seasonal schedule URL; publication date not shown | **High** — official visitor-center service evidence; exact travel-date service requires recheck. |
| E28 | Uber, [Ride request deep links](https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction) | Update date not shown | **High at evidence access** — handoff capability only; no fare/supply guarantee. Automated recheck returned 404; see below. |
| E29 | Lyft, [How to estimate ride cost](https://help.lyft.com/hc/en-us/all/articles/115013080308-How-to-estimate-the-cost-of-a-Lyft-ride) | Update date not shown | **High** — estimate/final-charge and availability caveats. |
| E30 | Google Travel Help, [Find plane tickets on Google Flights](https://support.google.com/travel/answer/2475306?hl=en) | ©2026; article date not shown | **High** — coverage, price, and self-transfer caveats; deep-link stability remains unknown. |
| E31 | Firecrawl, [pricing](https://www.firecrawl.dev/pricing), [monitoring](https://docs.firecrawl.dev/features/monitoring), and [document parsing](https://docs.firecrawl.dev/features/document-parsing) | Page dates not shown | **High** — current displayed credits, statuses, retention, and capabilities; future price stability is medium confidence. |
| E32 | Resend, [pricing](https://resend.com/pricing), [webhooks](https://resend.com/docs/webhooks/introduction), and [event types](https://resend.com/docs/webhooks/event-types) | Page dates not shown | **High** — current free limits, event model, at-least-once delivery behavior, and retention. |
| E33 | Bureau of Transportation Statistics, [On-Time Performance Technical Directive](https://www.bts.gov/explore-topics-and-geography/modes/aviation/number-39-technical-directive-reporting-time) and [TranStats](https://transtats.bts.gov/) | Directive issued 2024-12-03/effective 2025-01-01; referenced May 2026 file released 2026-06-30 | **High** for commercial definitions/data; **low transfer confidence** for Space-A analogues. |

### Mechanical link check

A mechanical GET check ran on **2026-07-28 UTC** for all 36 unique Markdown URLs. Results were 24 HTTP 200 responses, 10 HTTP 403 responses, one HTTP 404 response, and one timeout:

- DoD/AMC/Air Force and BTS returned 403 to the automated client. This records an automated-access limitation, not source absence; the evidence ledger retains the successful 2026-07-27 research access date.
- The cited Uber developer URL returned 404. Its implementation dependency requires recheck or an official replacement before use; no replacement is fabricated here.
- The cited Amtrak page did not return data within a 30-second HTTP/1.1 retry after an HTTP/2 stream error. The BWI Airport companion source returned 200.

All other cited URLs returned HTTP 200. A status response validates address reachability only, not source content, authorization, freshness, or future availability.
