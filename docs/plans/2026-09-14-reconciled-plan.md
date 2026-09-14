# PaxPivot — Reconciled plan (written 2026-09-14 on `main` @ 63e0935; status updated after the M1 deploy)

Evidence key: **[V]** verified in this pass · **[R]** reported by an earlier session, not re-verified ·
**[I]** inference · **[U]** unvalidated idea. Sizes are relative (S/M/L), not hours.

## Status (updated 2026-09-14, after the milestone M1 deploy)

Read this section first. Everything below it is the plan as written before execution; where it says
"uncommitted", "not started" or "PR open", this section is the current truth.

**Decisions.** The product owner answered **D-8: yes** (agents commit, open PRs, merge per
`docs/agent/MERGE_POLICY.md` and deploy for M1). On 2026-09-14 the owner also answered **D-1: (a)**
— request written permission to process the 72-hour schedule artifacts, and meanwhile build the
interim planner that never parses the artifacts — and **D-3: yes**, confirming the baseline pilot
traveler class (Cat VI sponsor plus accompanying minor dependent). **D-2** stays open (no
participant sessions have run), but on the same date the owner chose "where should I go to fly?"
as route search's first job, ahead of a D-2 answer; this departs from the plan's original
sequencing, where Path B was to follow M2. D-4 through D-7 are still open.

| WP | Task | Result | Merged |
|---|---|---|---|
| WP-01 | TASK-039 floating Ask clearance | done — three review rounds found dead space where the control is hidden (sticky-action-bar pages, then `/ask`); both fixed | f02c4be (PR #47) |
| WP-03 | TASK-041 derived source staleness | done — review found the terminal page would have said "No opportunities are published" for stale evidence; fixed | 35d31c7 (PR #48) |
| WP-04 | TASK-042 source reliability report | done — four review rounds found paused sources measured, unhashed and partly hashed sources passing detection, and the adapter-mismatch skip missing; all fixed, and check-sources' skip decision is now one shared function | 5ef033e (PR #49) |
| WP-02 | TASK-040 documentation truth | done — merged last, so the documents describe merged and deployed behaviour; review found CONTRACTS.md cited a nonexistent `repositories(engine)` symbol and the drift guard's link check would falsely fail a valid `path.md#section` link; both fixed | 979abc2 (PR #50) |
| — | TASK-043 web healthcheck | done — five review rounds settled on an engine-agnostic `interval`/`timeout`/`retries`/`start_period` healthcheck (an early `start_interval` design proved unsafe on Docker Engines older than 25) so `up --wait` now blocks until `web` actually answers `/login`; deploy still pending | 25f1264 (PR #52) |
| WP-05 / 06 / 07 | heartbeat / off-host backup / unused Redis | not started — wait on D-4 / D-5 / D-6 | — |

**Deployed.** `paxpivot-api:5ef033e` and `paxpivot-web:5ef033e` on the pilot VPS at 06:12 UTC on
2026-09-14, after CI `Quality` passed on that commit and after the 06:00 check had run; tag `56cee3a`
is kept for rollback. Verified: every container up, API `/ready` → 200, public `/login` → 200 and
signed-out `/terminals` → 307 (for a few seconds right after the switch the proxy answered 404 while
the new web container started), the four terminal pages `fresh` from the 06:00 check, and the
restricted artifacts' pre-restriction history shown as `source_stale`.

**First production source report** (`source-report 30`, 06:12 UTC): all four terminal pages **WATCH**
— completion 100 %, longest gap 6.0 h, no gap over 6.5 h, detection p95 6.0 h — because they were first
checked on 2026-09-11, so none can PASS until a full 30-day window exists (no earlier than
2026-10-11). The directory source is SKIPPED (disabled) and the four 72-hour artifacts are SKIPPED
(restricted). Exit 0. "16 read of 10 expected" reflects extra manual checks during the TASK-037/038
deploys; completion is capped at 100 %.

**M2 (the planner-path decision) opens** when D-1 and D-2 are answered and `source-report 30` covers a
full window. Run the report weekly until then (command in `docs/DEPLOYMENT.md`).

**Found during M1, not yet acted on:**
- The `web` service has no Docker healthcheck, so `up --wait` returns before Next.js serves and the proxy
  can answer 404 for a few seconds after a deploy (observed). Addressed by TASK-043 (`web` gets a
  `/login`-probing healthcheck; `--wait` then blocks until Next.js serves); pending deploy.
- The web accessibility tests run close to Vitest's 5 s default; under heavy parallel load on a
  developer machine they time out. CI has not been affected.
- Nothing alerts a person when checks stop (D-4), and backups still live only on the VPS (D-5).

---

# Part 1 — Report

## 1. Bottom line

The plans and the repository have drifted apart in five specific ways:

1. **Two finished units were never landed.** The floating-Ask clearance fix and the README truth
   pass plus its drift guard are still uncommitted in the main checkout. `make test-unit` passes
   with them (261 Python, 339 web) [V].
2. **The documentation pass has two small defects of its own.** The README says "the six
   `docs/tasks/TASK-03*` contracts", but there are nine (030–038) [V]. The guard's "blocked claims"
   test asserts nothing in its `blocked` branch, and the "vice versa" its docstring promises is not
   implemented [V].
3. **Task statuses mislead.**
   - TASK-015 still reads `review`, but it merged in `99ab982` (PR #22) [V].
   - TASK-033, TASK-035 and TASK-036 say "blocked, see AUDIT.md §4/§6". The real blocker for 033
     and 036 is TASK-032, which is blocked on written permission for the marked schedule artifacts.
   - TASK-035 is **not** blocked by that permission. It only waits for the owner to confirm the
     pilot traveler class [V].
   - TASK-032's contract names migration `0004`, which `0004_trip_requests.py` already uses [V].
4. **The top validation risk is still open and still silent.** Nothing derives staleness:
   - The provider writes `fresh` at retrieval time.
   - The read services pass the stored state straight through.
   - The web deliberately does no freshness maths.

   So a stopped cron shows "Fresh" forever [V]. The public `/health` and `/ready` both answer
   `307 → /login`, so no outside monitor can see an outage either [V].
5. **The 30-day source-health series is being collected but not measured.** The 6-hourly cron has
   been appending observations since the TASK-025/038 deploys (around 2026-09-11) [R]. Nothing
   computes the baseline's pass metric (≥ 95 % checks completed, change detected within 6.5 h) [V].

**Recommended direction:** keep building incrementally, no rebuild. For the next milestone, make
the existing source watch *measurably trustworthy* while the owner answers the two questions only
the owner can answer:

- **M0-A:** will permission to process the schedule artifacts be sought?
- **M0-B:** do Cat VI travelers want this job done?

Then choose the planner path from those answers plus the 30-day numbers.

## 2. Plan ledger — what each plan said vs. what is true now

Plans reconciled:

- **P1** — `AUDIT.md` task plan (2026-09-11).
- **P2** — validation review (27 Jul 2026, `firstmate/.lavish/paxpivot-validation-review.html`).
- **P3** — the corrected product review. It exists here only through the pasted session reports:
  it names M0-A, M0-B, the FAB fix, a documentation-truth pass and derived staleness. The full
  document was not found on disk or in PaxPivot transcripts.
- **P4** — loose follow-ups found in the repo.

| Item | Plan | Recorded status | Actual state | Reconciled status |
|---|---|---|---|---|
| QW-1 Plan↔Trips loop fix | P1 | done | on `main` [V] | **done** |
| TASK-031 corpus capture | P1 | done | merged PR #40; its target (terminal pages) turned out to carry no departure rows [V] | **done** (purpose mooted) |
| TASK-032 schedule parser | P1 | blocked | retargeted to the 72-hour artifacts, which are CUI-marked and user-open-only (option 1) [V]; contract still names migration 0004 [V] | **blocked on M0-A** |
| TASK-033 terminal departures | P1 | blocked ("see AUDIT") | depends only on TASK-032 [V] | **blocked (via 032)**; fix status text |
| TASK-034 trip request | P1 | done | 3 routes, migration 0004 [V] | **done** |
| TASK-035 eligibility v1 | P1 | blocked ("see AUDIT") | deps = TASK-034 (done) + owner confirms traveler class and citations [V]; baseline already defines the class (Cat VI sponsor + accompanying minor dependent, ELG-001…005) [V] | **needs one owner confirmation (D-3)**, then value-gated by M0-B |
| TASK-036 opportunities + route cards | P1 | blocked | deps 032 + 034 + 035 [V] | **blocked (via 032)** |
| M3 resolver / ground routing / readiness / alerts | P1 | not started | geocoding and routing providers still need accounts [V] | **deferred to the M2 path decision** |
| TASK-037, TASK-038 | follow-ups | done | deployed [V] | **done** |
| TASK-015 Ask presentation | older | `review` | merged `99ab982` [V] | **done — status stale** |
| FAB bottom clearance | P3 | uncommitted | diff present; unit suites green [V]; browser hit test at document end [R] | **implemented, unlanded → WP-01** |
| Documentation truth pass + guard | P3 | uncommitted | README + `tests/unit/test_docs_consistency.py` present, guard green [V]; the defects above [V]; bare `pytest` from repo root errors on the committed `CLAUDE.md` symlink (mode 120000, target is text) [V] | **implemented, unlanded, 2 fixes → WP-02** |
| Derived source staleness | P3 | "next" | not started; confirmed necessary by code trace [V] | **ready → WP-03** |
| M0-A source-permission decision | P3 | owner | not recorded anywhere; TASK-037 still says option 1 [V] | **open (owner) → D-1** |
| M0-B 5–10 user sessions | P3 | owner | no evidence in repo [V] | **open (owner) → D-2** |
| 30-day source reliability series | P2 | implied | collecting [R], never measured [V] | **in motion, unmeasured → WP-04** |
| Silent staleness (risk #1) | P2 | open | still silent in UI [V] and externally [V] | **open → WP-03 + WP-05** |
| Minimal public waitlist / content | P2 | allowed by recorded call #3 | nothing built [V] | **experiment E-2, after D-2** |
| Paid pivot beta | P2 | gated | — | **gated; not in this plan** |
| Firecrawl key rotation | P1 §3 | owner pending | not verifiable from repo | **unknown → D-7** |
| Off-host backup copy | P4 (DEPLOYMENT) | "follow-up" | still says follow-up [V] | **open → D-5 / WP-06** |
| Redis + rq | P3 note | — | declared, running in `compose.prod.yml`, imported by nothing [V] | **removal proposed → D-6 / WP-07** |

## 3. Recommended direction and why

**Direction: "a trustworthy source watch for one pilot, then a deliberate planner-path decision."**

Why:

- The planner cannot exist without a permitted source of departure evidence. The only
  departure-level sources are notice-marked, and the owner chose user-open-only [V]. That is an
  external blocker, and code cannot remove it.
- Whether travelers want the planner (or a simpler job) is unproven (P2 track 6) [V].
  Building eligibility or route cards before M0-B risks polishing an unwanted workflow.
- Measurable source trust is needed on **every** future path:
  - Path A (permitted parsing) needs it for the SRC-009 gate.
  - Path B (no movement data) needs it because source watch is part of that product.
  - Path C (stop) needs it to produce the kill/continue evidence.
- It is cheap, fully in-repo and needs no product decision [V].

**Paths the M2 decision chooses between** (all reuse today's system; none needs a rebuild):

| Path | Condition | What gets built next | Reuses |
|---|---|---|---|
| **A — Permitted parsing** | D-1 yields written permission | TASK-032 → 033 → 035 → 036 (existing contracts; update migration numbers) | everything |
| **B — Trip coach without movement data** [U] | no permission, and D-2 shows demand for readiness, terminal logistics, watch and fallback | eligibility/readiness (TASK-035 + ELG-004/005 copy), commercial handoff link (E-1), optional user-declared leg (E-3, needs a data-classification review) | terminals, source watch, trips, UI foundation |
| **C — Watch only / stop** | D-2 shows no demand, or the source series fails | nothing new; keep or retire the pilot | — |

**Incremental vs. selective vs. full rebuild.** Incremental wins. The architecture is healthy:
policy gate in front of processing, append-only observations, honest states, strong tests [V].
Every limit on the product is external (permission, demand, provider accounts). A selective or
full rebuild would cost weeks and unblock none of them.

## 4. Highest-value improvements (value tests)

### I-1 Land the two finished units (WP-01, WP-02) — S, confidence high

- **Affected:** every future agent and reader; the pilot user on long pages.
- **Problem:** verified work sits uncommitted in the main checkout, where it can be lost or
  clobbered, and the README it corrects is still false on `main`.
- **Behavior:** two focused PRs. One is the CSS fix. The other is the README, the guard, the two
  guard fixes and task-status normalization.
- **Outcome:** `main` tells the truth, and any future README drift fails CI.
- **Evidence:** diff and tests [V]; browser hit test [R].
- **Simplest alternative:** one combined commit. Rejected because AGENTS.md requires one task
  file per unit.

### I-2 Derived source staleness (WP-03) — S, confidence high

- **Affected:** the pilot traveler (terminal cards and detail) and the operator (`/advanced`).
- **Problem:** if the cron, host or provider stops, the last `fresh` observation stays "Fresh"
  indefinitely. That breaks SRC-008 (a current view needs a successful check within 6.5 h) and
  the invariant "stale remains visible" [V].
- **Behavior:** at read time, a `fresh` (or future success-derived) observation older than 6.5 h
  is reported as `source_stale` with the stale explanation. The stored observation is never
  changed. There is no migration and no web change, because the web already renders
  `source_stale` [V].
- **Outcome:** an outage becomes visible in the app within 6.5 h.
- **Evidence:** `firecrawl.py:303` writes `FRESH`; `read_services.evidence_read` passes the state
  through; `source-state.ts` says the UI never derives [V].
- **Simplest alternative:** an external heartbeat only (WP-05). That alerts the operator but
  leaves the UI lying, so the two are complementary.

### I-3 Source reliability report (WP-04) — S–M, confidence medium on value

- **Affected:** the product owner making the M2 decision.
- **Problem:** P2's first gate is a 30-day reliability series. Data accumulates every 6 h, but
  nobody can read the pass/stop metrics without hand-written SQL.
- **Behavior:** `make source-report DAYS=30` reports, per source:
  - expected vs. successful checks and completion %
  - longest gap
  - gaps over 6.5 h
  - hash changes
  - an upper bound on detection latency
  - a PASS / WATCH / STOP verdict against baseline thresholds (paxpivot.md lines 541, 583) [V]
- **Outcome:** the M2 decision rests on numbers.
- **Simplest alternative:** one hand-run SQL query at day 30. It is viable, but not repeatable,
  easy to get wrong on p95 and gaps, and has no test.

### I-4 External heartbeat (WP-05) — S, gated on D-4, confidence medium

- **Affected:** the operator.
- **Problem:** the pilot has one user who may not open the app for days. A failed check run
  (exit 2 or 3) or a dead host produces no signal and silently erodes the 30-day series [V].
- **Behavior:** the cron line pings a dead-man monitor only on success; the monitor alerts when a
  ping is late.
- **Simplest alternative:** check `/advanced` by hand every day.

### I-5 Normalize task statuses and blockers (inside WP-02) — S, confidence high

- **Problem:** statuses point agents at the wrong blocker. An agent reading TASK-035 sees a
  blocker that no longer exists; one reading TASK-033 is sent to AUDIT.md instead of TASK-032 [V].
- **Behavior:** fix the TASK-015, 032, 033, 035 and 036 status lines, and add a one-line
  "superseded; statuses live in the task files" banner to AUDIT.md §5/§7.

### Not recommended now

- **Eligibility engine (TASK-035)** before M0-B. The pilot user already knows their own
  eligibility, so its value is for *new* travelers, which is exactly what M0-B tests [I].
- **Any AI integration** (see §6).
- **Per-user auth, notifications backend, maps.** These are PRD release gates for a multi-user
  release that is not planned yet.

## 5. Retain / improve / rebuild / remove

| Retain | Improve | Rebuild | Remove (proposed) |
|---|---|---|---|
| Source policy gate; append-only observations; 13-state model; honest empty/error states; task-contract + PR-per-task workflow; the new README drift guard; ADR-005 access boundary | Staleness (WP-03); reliability measurement (WP-04); external alerting (WP-05); off-host backup (WP-06); task-status hygiene and guard logic (WP-02) | Nothing | Redis + rq from Compose and dependencies until a worker exists (WP-07, ask first: it contradicts PRD Milestone A and touches infrastructure). The committed `CLAUDE.md` symlink-with-text-target becomes a regular file (inside WP-02, ask first: instruction file) |

## 6. AI position

**No AI in M1.** The PRD lets AI only interpret intent and explain deterministic outputs [V].
Today there is no eligibility decision, opportunity or route to explain, and `/ask` is
presentation only [V]. An assistant now would have nothing to ground on and would be one prompt
away from inventing movement facts.

Staleness, reliability and eligibility are deterministic rules. Conventional code is cheaper,
testable and exact for them.

Two AI uses are worth keeping on the map, each gated:

- **AI-1 — Assisted corpus labeling (Path A only).**
  - *Workflow:* for each permitted schedule artifact, a model proposes critical-field labels
    (date/time, destination, seat-state text, roll call). A person accepts or corrects every label.
    The deterministic parser stays the only runtime path.
  - *Data:* only artifacts the written permission covers. If the permission forbids third-party
    processing (likely for CUI-marked material [I]), use a local model on the owner's machine, or
    no model.
  - *Autonomy:* suggest-only; nothing is stored without human confirmation.
  - *Evaluation:* agreement between suggested and final human labels (report only). The SRC-009
    gate (≥ 99 % exact critical fields, zero false rows) is judged against human labels, never
    against model output.
  - *Failure recovery:* a bad suggestion costs reviewer time only.
  - *Latency and cost:* offline batch over tens of documents, so cost is negligible on an API.
    Self-hosting costs setup time, not money.
  - *Replaceability:* start as a script calling one model. Introduce a port only when a second
    provider is actually needed.
- **AI-2 — Ask PaxPivot over typed tools (PRD Milestone F).** Only after TASK-036 produces
  deterministic outputs. Its release test is PRD §23 item 13 (hallucination fixtures). It is not
  specified further here.

## 7. Tradeoffs, uncertainties, blind spots

- **Tradeoff:** M1 adds no traveler-facing capability. It buys evidence and trust, which is right
  only while M0-A and M0-B are pending. If the owner already knows the answers, skip to M2.
- **Blind spot — provider credits** [I, unverified]. The runbook says 4 credits per run every 6 h,
  so about 16 credits/day and about 480/month [V from runbook arithmetic]. If the Firecrawl account
  has a small or one-time allowance, checks start failing around the time the 30-day series
  completes, which would corrupt the evidence the M2 decision needs.
  *Cheapest check:* the owner reads the Firecrawl dashboard balance and plan (1 minute) → D-7.
- **Blind spot — the planner-shaped navigation.** `/ask`, `/profile/*`, compare and route detail
  are honest empty states [V via README]. M0-B participants may read that as broken.
  *Cheapest check:* watch for it in the sessions; build nothing now.
- **Blind spot — user workaround.** Today a traveler opens the terminal PDF, reads it and runs a
  commercial search themselves [I]. Path B works *with* that workaround instead of replacing it.
  Whether that is enough value is exactly M0-B's question.
- **Uncertainty:** whether SRC-008's "absent cadence → freshness unknown" needs its own state.
  There is no such enum value [V]. WP-03 applies the 6.5 h rule regardless of cadence, which is
  stricter, and records this as Q-3.
- **Uncertainty:** `monitor_delayed` stays unproduced. With a 6 h cadence and a 6.5 h threshold,
  its window would be 30 minutes of noise [I].
- **Inspection limits:**
  - The signed-in UI was not browsed in this pass.
  - The production database was not queried.
  - Docker is down locally, so `make test-integration`, `migrate-check` and `migrate-test` were
    not run.
  - `make lint`, `typecheck` and `build` were reported green earlier [R] but not re-run.
  - The full P3 document was not found.
  - The 48 KB validation synthesis report was not re-read.

## 8. First milestone — M1 "Trustworthy source watch"

- **Contents:** WP-01 → WP-02 → WP-03 ∥ WP-04. WP-05, WP-06 and WP-07 follow as their owner
  decisions arrive.
- **Done when:**
  - All M1 task files are `done` with merge commits.
  - The API is deployed with WP-03 and WP-04.
  - `make source-report` output from production is recorded in the TASK-042 handoff.
  - D-4, D-5 and D-6 are answered and their work packages completed or explicitly declined.
- **The owner runs D-1 and D-2 in parallel.** M2 (the path decision) opens when both are answered
  and the report covers ≥ 30 days (no earlier than about 2026-10-11 [I]).

---

# Part 2 — Implementation handoff

## 1. Scope and decisions

### Objectives (M1)

- O-1: `main` contains the two finished units, with truthful docs and statuses.
- O-2: An observation older than the SRC-008 window is never presented as current.
- O-3: The 30-day source-health gate can be computed on demand.
- O-4: A failed or missing check run reaches a person without anyone opening the app (gated D-4).
- O-5: A backup survives loss of the VPS (gated D-5).

### Constraints (inherited, non-negotiable)

- AGENTS.md: one task file per unit from `docs/tasks/TASK_TEMPLATE.md`; owned paths; foundation
  owns shared contracts, schema and API; follow `docs/agent/WORKFLOW.md` §7 lifecycle and
  `docs/agent/MERGE_POLICY.md`.
- Never fetch, parse, hash or display the restricted 72-hour artifacts (TASK-037, option 1).
- Observations are append-only; derived state is computed at read time only.
- The repo is public: no page bodies, secrets or production data in git.
- The web never derives source state (`apps/web/lib/presentation/source-state.ts` header).
- Merge and deploy only with the product owner's authorization for this run. Record verification
  honestly: never claim a gate that was not run.

### Non-goals (M1)

Parsing, eligibility, opportunities, route cards, AI, notifications, per-user auth, maps, the
`monitor_delayed` derivation, public waitlist, and any change to source registration or policy.

### Architecture decisions (resolved here)

- **AD-1** — Effective source state is derived in `application/read_services.py`, not in the
  provider, the database or the web. The response field `state` carries the **effective** state.
  Shape is unchanged, meaning is documented. No new ADR; add one paragraph to
  `docs/architecture/CONTRACTS.md`.
- **AD-2** — The freshness window is a single constant of 6 h 30 min (SRC-008). It applies to
  `fresh`, `no_departures_published` and `no_compatible_opportunity`, the states that require a
  successful observation. Failure, restricted, superseded, withdrawn, review and conflict states
  are unchanged.
- **AD-3** — Reliability maths is a pure function in a new application module, with the CLI as a
  thin shell. Nothing is written to the database.
- **AD-4** — The heartbeat is an external dead-man monitor pinged by the cron line on success. No
  in-app scheduler.

### Owner decisions (not agent work)

| ID | Question | Options | Blocks | Cheapest way to decide |
|---|---|---|---|---|
| D-1 (M0-A) | Seek written permission to process the 72-hour schedule artifacts? | (a) request it · (b) permanent user-open-only · (c) stop planner ambition | TASK-032/033/036, AI-1, Path A | One written request to AMC Public Affairs or the JB MDL terminal. Gate: a written answer, or 30 days of silence → treat as (b) |
| D-2 (M0-B) | Do Cat VI travelers want this, and which job most? | top pain = finding departures / eligibility and documents / onward commercial / return / none | TASK-035 value, E-1…E-3, the M2 path | 5–10 sessions walking through each participant's last Space-A attempt. Gate: a clear majority names the same top pain; otherwise Path C |
| D-3 | Pilot traveler class for TASK-035 | confirm the baseline (Cat VI sponsor + accompanying minor dependent, DoDI 4515.13 Change 7) · or a new class | TASK-035 → ready | Yes/no |
| D-4 | External heartbeat monitor | a free dead-man monitor (owner creates the account; the URL is a secret) · decline | WP-05 | Yes/no + URL placed in `/opt/paxpivot/.env.production` |
| D-5 | Off-host backup destination | object storage bucket · owner machine via rsync/ssh · decline | WP-06 | Choose + credentials |
| D-6 | Remove unused Redis/rq | remove until a worker exists · keep | WP-07 | Yes/no |
| D-7 | Firecrawl account health | confirm plan/credit balance and whether the key was rotated | risk to the 30-day series | Dashboard check |
| D-8 | Authorize agents to commit, open PRs, merge per MERGE_POLICY and deploy for M1 | yes · commit/PR only · no | WP-01…WP-04 landing | Yes/no |

### Experiments (not committed; each needs its gate)

- **E-1 Commercial baseline link on the trip page** [U] (after D-2 names onward commercial; the
  recorded call #2 already limits this to best-effort links). A prefilled Google Flights search
  from the origin terminal's nearest airports to the trip's destination text and window. Measured
  qualitatively in M0-B follow-ups.
- **E-2 Minimal public waitlist / content page** [U] (after D-2; the recorded call #3 allows
  minimal waitlist/content only).
- **E-3 User-declared leg** [U] (Path B only). The traveler records the leg they intend to try, so
  onward and fallback planning can anchor to it. Needs an OPSEC / data-classification review
  before any storage of user-entered movement plans.

### Open questions (tracked, not blocking M1)

- **Q-1:** geocoding provider (destination resolver).
- **Q-2:** ground-routing provider.
- **Q-3:** does "freshness unknown" (SRC-008, absent cadence) need its own state?
- **Q-4:** is the planner-shaped navigation confusing to new participants (answered by D-2)?

## 2. Detailed specifications

### S-1 Derived staleness (WP-03)

**Rule**

```text
WINDOW = 6h30m                                  # SRC-008, paxpivot.md line 222
SUCCESS_STATES = {fresh, no_departures_published, no_compatible_opportunity}
effective(obs, now):
    age = now - obs.provenance.observed_at
    if obs.state in SUCCESS_STATES and age > WINDOW:  return obs with state=source_stale
    return obs                                   # includes age <= WINDOW and future-dated (clock skew)
```

**Behavior**

- `evidence_read(observation, now)` builds `state` **and** `explanation` from the effective
  observation, so the stale copy in `source_explanation.py` is used.
- Build the effective observation with `model_copy(update=…)` and never persist it.
- `now` is resolved once per request in `list_terminal_network`, `get_terminal_detail` and
  `list_source_health` (`now = now or datetime.now(UTC)`), then threaded to `terminal_summary`,
  `health_row` and `evidence_read`. `generated_at` uses the same value.
- Source-health `counts` count effective states, which follows automatically from `row.latest.state`.
- The newest-observation choice is unchanged (still by `observed_at`).
- Restricted sources are still excluded from terminal evidence.

**UI states**

- No web change. `source_stale` renders "Stale", tone caution, sr-text "no recent successful read;
  nothing here is current" [V]. The acceptance run confirms it on `/terminals`, `/terminals/{id}`
  and `/advanced`.

**Failure handling**

- A clock ahead of `observed_at` gives a negative age, which counts as current.
- A missing observation stays "never observed".
- No exception paths are added.

**Contract note** — add one paragraph to `docs/architecture/CONTRACTS.md`: "`state` on evidence
reads is the effective state at `generated_at`; stored observations are unchanged; see TASK-041."

### S-2 Source reliability report (WP-04)

**Interface**

- `python -m paxpivot.tooling source-report [--days N=30] [--now ISO8601]`
- Makefile target `source-report` (`DAYS` variable)

**Scope**

- Enabled sources whose policy is not restricted.
- Sources with `cadence_minutes = NULL` are listed as "cadence unknown" and excluded from the
  verdict.

**Per source, over `[now − days, now]`**

| Field | Definition |
|---|---|
| expected | `floor(window_minutes / cadence_minutes)` (assumes cron interval = cadence; print that assumption) |
| recorded | observations in window |
| successful | observations with retrieval `succeeded` |
| completion % | `min(100, successful / expected × 100)` |
| longest gap | max interval between consecutive successful reads, including window start → first and last → `now` |
| gaps > 6.5 h | count |
| hash changes | successful reads whose content hash differs from the previous successful read |
| detection p95 (upper bound) | p95 of the gap preceding each hash-changing read; `n/a` when fewer than 2 changes |
| verdict | **STOP** if completion < 90 % or longest gap > 18.5 h (6.5 h + 12 h); **PASS** if completion ≥ 95 % and detection p95 ≤ 6.5 h (or `n/a`); otherwise **WATCH** |

**Output and exit codes**

- Plain-text table plus a first line stating the window and the cron-equals-cadence assumption.
- Exit `0` for PASS/WATCH, `1` if any source is STOP, `2` if there are no observations in the window.
- Prints no URLs' content (none is stored anyway).

**Code layout**

- Proposed `apps/api/paxpivot/application/source_reliability.py` holds the pure
  `reliability(observations, cadence_minutes, window_start, now) -> SourceReliability`.
- The CLI reads through existing repository ports. If `ObservationReader` lacks a
  "list observations for a source between times" read, add one (a foundation-owned port change;
  record it in the task file).

### S-3 Documentation guard fixes (WP-02)

- Replace the tautological branch in `test_blocked_claims_match_the_task_contracts` with both
  directions:
  1. every `TASK-NNN` the README names has status `blocked` or `done`;
  2. every contract whose status is `blocked` is named in the README.
- Keep the pinned `032/033/035/036` assertion.
- Delete the README's numeric claim ("The six `docs/tasks/TASK-03*` contracts") rather than
  testing prose. Name the blocked tasks instead.
- Status normalization, text only:
  - TASK-015 → `` `done` — merged to `main` in 99ab982 (PR #22) ``.
  - TASK-033/036 → blocked by TASK-032 (written permission, TASK-037).
  - TASK-035 → blocked on product-owner confirmation of the pilot traveler class (D-3); not
    blocked by source permission.
  - TASK-032 body → "next free migration revision" instead of `0004`.
- `AUDIT.md`: one banner line under the title: "Historical (2026-09-11). Current status lives in
  each `docs/tasks/` file."
- **Ask first:** replace the committed `CLAUDE.md` symlink (mode 120000, text as target) with a
  regular file of the same text. That makes bare `pytest` from the repo root work.

### S-4 Heartbeat (WP-05, gated D-4)

- Cron line in `docs/DEPLOYMENT.md` and `/etc/cron.d/paxpivot-checks`:
  `… check-sources && curl -fsS -m 10 --retry 3 "$PAXPIVOT_HEARTBEAT_URL" >/dev/null`.
  Exit 2 (no key) or 3 (provider failed) skips the ping [V exit codes, README].
- Monitor period 6 h, grace 1 h, alerting to the owner's chosen channel.
- The URL lives only in `/opt/paxpivot/.env.production`, never in git.

### S-5 Off-host backup (WP-06, gated D-5)

- After the existing 03:15 UTC `pg_dump`, copy the newest dump to the D-5 destination.
- Retention there is ≥ 30 days.
- A restore drill from the **off-host** copy into a scratch database must match row counts of
  `source_observations` and `trip_requests`.
- Update the DEPLOYMENT.md backup section and remove "follow-up".

### S-6 Redis/rq removal (WP-07, gated D-6)

- `grep -rni redis` across the repo first. Known touch points [V]: `compose.prod.yml` (service,
  `REDIS_URL`, `depends_on`), `compose.yml`, `pyproject.toml` / `uv.lock` (`redis`, `rq`), README
  toolchain and command notes.
- Likely also `.env.example` and the ADR-002 port derivation in `make setup` tooling (verify).
- Record the PRD Milestone A deviation in a short ADR at the next free number. Verify the number:
  TASK-035/036 contracts reserve ADR-007/008.

## 3. Work packages

| WP | Task file (proposed) | Role | Size | Depends on | Gate |
|---|---|---|---|---|---|
| WP-01 | `docs/tasks/TASK-039-floating-ask-clearance.md` | build | S | — | D-8 |
| WP-02 | `docs/tasks/TASK-040-documentation-truth.md` | foundation | S | WP-01 merged (serializes docs/tasks edits) | D-8 |
| WP-03 | `docs/tasks/TASK-041-derived-source-staleness.md` | foundation | S | — (merge after WP-02 to avoid README/CONTRACTS conflicts) | D-8 |
| WP-04 | `docs/tasks/TASK-042-source-reliability-report.md` | foundation | S–M | WP-02 merged (README command row) | D-8 |
| WP-05 | `docs/tasks/TASK-043-check-heartbeat.md` | foundation (ops) | S | WP-03 deployed | D-4 |
| WP-06 | `docs/tasks/TASK-044-off-host-backup.md` | foundation (ops) | S | — | D-5 |
| WP-07 | `docs/tasks/TASK-045-remove-unused-redis.md` | foundation | S | WP-02 merged | D-6 |

Task numbers are proposals. Take the next free number at creation time; `TASK-038` is the last on
`main` [V].

### WP-01 — Land the floating-Ask clearance (TASK-039)

- **Objective:** commit the verified CSS fix as its own unit.
- **Files (existing, modified in the main checkout):** `apps/web/styles/tokens.css`,
  `apps/web/styles/components.css`, `apps/web/tests/shell.test.tsx`. Plus a new task file.
- **Instructions:**
  1. In the main checkout, save `git diff -- apps/web/styles apps/web/tests/shell.test.tsx` to a
     patch outside the repo.
  2. Create a worktree from `origin/main` on `build/TASK-039-floating-ask-clearance`
     (`make setup` there, per ADR-002), apply the patch and write the task file from the template.
  3. Do **not** touch the README or test_docs_consistency.
  4. After merge, confirm `git diff origin/main -- <those three files>` is empty in the main
     checkout before discarding those local changes there.
- **Acceptance:**
  - `.pp-main` and `.pp-guarantee` reserve `--nav-height` + `--fab-height` on mobile and
    `--fab-height` on desktop.
  - The shell test fails with the CSS reverted and passes with it.
  - At document end, the only element under the control is non-interactive background at 320,
    390, 420, 768 and 1280 px widths.
  - No horizontal overflow.
- **Verification:**
  - `make format-check lint typecheck test-unit build`.
  - Hit test with `elementFromPoint` over the control's box at document end (use a
    `javascript_tool` probe; screenshots are unreliable in this environment).
  - Do **not** use bounding-box intersection mid-scroll: that produced a false positive before.
- **Deliverables:** PR, task file with Handoff, CI green.

### WP-02 — Documentation truth, guard fixes, status normalization (TASK-040)

- **Objective:** land the README rewrite and guard, fixed per S-3.
- **Files:**
  - existing: `README.md` (modified), `tests/unit/test_docs_consistency.py` (untracked),
    `docs/tasks/TASK-015-…`, `TASK-032-…`, `TASK-033-…`, `TASK-035-…`, `TASK-036-…`, `AUDIT.md`
  - proposed: the task file
  - optional, ask first: `CLAUDE.md`
- **Instructions:**
  1. Worktree from `origin/main` after WP-01 merges. Copy the README and the test file from the
     main checkout.
  2. Apply S-3.
  3. Re-prove each guard fails on injected drift: undocumented route, ghost row, stale migration
     range, a blocked contract missing from the README, a README-named task with status `review`,
     dead link. Restore after each.
- **Acceptance:**
  - Guard green on `main`.
  - Each injected drift yields its own failure message.
  - No README numeric claim about contract counts.
  - The status lines match S-3 exactly.
- **Verification:** `make format-check lint typecheck test-unit build`. Plus `make test-integration`
  and `migrate-check` if Docker is available; otherwise state "not run".
- **Deliverables:** PR, task file with Handoff listing each drift injection and its failure message.

### WP-03 — Derived source staleness (TASK-041)

- **Objective:** O-2 per S-1.
- **Files:**
  - existing: `apps/api/paxpivot/application/read_services.py`,
    `tests/unit/test_read_services.py`, `docs/architecture/CONTRACTS.md`
  - possibly `tests/unit/support_sources.py` (its `observation(...)` helper and `NOW` exist [V])
  - proposed: the task file
- **Instructions:**
  1. Write failing time-travel tests first.
  2. Implement `effective` plus `now` threading.
  3. Do not change the provider, schema, migrations, API shape or web.
- **Acceptance (tests):**
  - `fresh` at 6 h 29 m → `fresh`.
  - `fresh` at 6 h 31 m → `source_stale` and the stale explanation.
  - Exactly 6 h 30 m → `fresh`.
  - `source_unreachable` at 10 h → unchanged.
  - Future-dated `observed_at` → unchanged.
  - Source-health counts reflect effective states.
  - Terminal network headline and terminal detail per-source rows both carry the effective state.
  - `generated_at == now` everywhere.
  - Stored observations are untouched (the fake repository item is equal before and after).
- **Verification:** `make format-check lint typecheck test-unit`, plus `make test-integration`
  (API boot) when Docker is available.
  **Local E2E:** `make dev`. Run `check-sources` once (needs `FIRECRAWL_API_KEY`), or use the
  seeded observations. Then call the read service with `now = observed_at + 7h` through a unit
  test, not by editing the database. Signed-in `/terminals` must still show Fresh right after a
  real check.
- **Deliverables:** PR, task file, CONTRACTS.md paragraph.

### WP-04 — Source reliability report (TASK-042)

- **Objective:** O-3 per S-2.
- **Files:**
  - existing: `apps/api/paxpivot/tooling.py`, `Makefile`, `README.md` (Commands table row),
    `docs/DEPLOYMENT.md` (how to run on the VPS: `docker compose … exec -T api python -m
    paxpivot.tooling source-report --days 30`)
  - possibly `application/ports/repositories.py` and `infrastructure/repositories.py` (new read)
  - proposed: `apps/api/paxpivot/application/source_reliability.py`,
    `tests/unit/test_source_reliability.py`, the task file
- **Acceptance (tests on synthetic series):**
  - A perfect 30-day series → PASS.
  - One 13 h gap → WATCH, with gaps > 6.5 h = 1.
  - A 20 h gap → STOP.
  - 85 % completion → STOP.
  - Cadence NULL → "cadence unknown", excluded from the verdict.
  - Zero observations → exit 2.
  - Hash changes with known gaps → the expected p95 upper bound.
  - The CLI prints the assumption line.
- **Verification:** unit gates, plus `make test-integration` if the repository read changed and
  Docker is available.
  **Production** (only with D-8 deploy authorization): run on the VPS and paste the output into
  the Handoff.
- **Deliverables:** PR, task file, the first production report.

### WP-05 — Check heartbeat (TASK-043, gated D-4)

- **Files:** `docs/DEPLOYMENT.md`, the task file. The VPS cron change and env var are recorded as
  manual steps, not committed secrets.
- **Acceptance:** after the next scheduled run the monitor shows a ping, and the monitor's test
  alert reaches the owner.
- **Verification:** the monitor dashboard, plus `grep` on the VPS cron file (URL redacted in the
  Handoff).

### WP-06 — Off-host backup (TASK-044, gated D-5)

- **Files:** `docs/DEPLOYMENT.md`, the task file; host-side script per D-5.
- **Acceptance and verification:** the S-5 restore drill from the off-host copy, with row counts
  recorded in the Handoff.

### WP-07 — Remove unused Redis/rq (TASK-045, gated D-6)

- **Files:** per S-6 grep; a new ADR (next free number).
- **Acceptance:**
  - `make check` green (Docker required).
  - `docker compose -f compose.prod.yml config --quiet` valid.
  - No `redis` or `rq` in `uv.lock`.
  - README toolchain line removed.
  - Production deploy leaves no redis container.
- **Rollback:** redeploy the previous tag (no data lives in Redis: it runs without persistence [V]).

### Path work after M2 (sketch only; each item gets its own task file when chosen)

- **Path A:** unblock TASK-032 (migration number, corpus under the permission terms, AI-1
  optional) → TASK-033 → D-3 → TASK-035 → TASK-036. The existing contracts are the specification.
- **Path B:** D-3 → TASK-035 (eligibility + ELG-004/005 readiness copy) → E-1 → E-3 after review.
- **Path C:** keep the watch running at minimal cost, or retire it through the DEPLOYMENT.md
  rollback and backup steps.

## 4. Agent coordination

- **Single agent:** do WP-01 → WP-02 → WP-03 → WP-04, then WP-05/06/07 as decisions arrive.
- **Multiple agents:**
  - The **lead (foundation)** owns WP-02, WP-03 and WP-04, all `docs/tasks/` status lines,
    `README.md` and `docs/architecture/CONTRACTS.md`.
  - A **build agent** may take WP-01 alone.
  - WP-03 and WP-04 may run in parallel worktrees: disjoint code files; WP-04 alone touches
    `README.md` and `Makefile`.
- **Integration order:** WP-01 → WP-02 → WP-03 → WP-04 (rebase on WP-03) → single API deploy
  carrying WP-03 + WP-04 → WP-05 → WP-06 / WP-07 in any order.
- **Shared contracts:**
  - The evidence read `state` semantics (AD-1): lead-owned.
  - `ObservationReader` port additions (WP-04): lead-owned; a build agent stops and escalates per
    WORKFLOW.md.
- **Conflict resolution:**
  - The lead rebases and resolves README / docs/tasks / CONTRACTS conflicts.
  - Build agents never edit files outside their owned paths.
  - Disagreement with this plan goes into the task file's "Blocked / contract change needed"
    section, not into code.
- **The main checkout** holds the only copy of the unlanded work. No agent runs `git checkout --`,
  `stash drop` or `reset` there until the corresponding PR is merged and the diff against
  `origin/main` is confirmed empty.

## 5. Validation and release

- **Per-PR gates:** `make format-check lint typecheck test-unit build`. Add `make test-integration
  migrate-check` for API changes when Docker is up. CI `Quality` must be green. Follow the review
  requirement in MERGE_POLICY.md (fresh review, 0 Critical / 0 Important).
- **Honesty rule:** a gate not run is reported as "not run" with the reason.
- **Migrations and backfill:** none in M1. Staleness is derived; the report is read-only.
- **Observability:**
  - WP-05 heartbeat.
  - `make source-report` run weekly by the owner or an agent, output appended to the TASK-042
    Handoff until M2.
  - Existing `/advanced` source health.
- **Rollout:**
  - Single-user pilot: one API image deploy per `docs/DEPLOYMENT.md` "First start / upgrade"
    (the VPS has no `make`; build with `docker build -f apps/api/Dockerfile`, set `PAXPIVOT_TAG`).
  - The web is unchanged by WP-03/04. It changes only with WP-01, which ships as a web image with
    the same procedure.
- **Rollback:** set `PAXPIVOT_TAG` to the previous tag and `up -d --wait --no-build`. Safe because
  M1 has no migrations.
- **E2E user acceptance (M1):**
  1. Signed-in `/terminals` and `/advanced` show Fresh for sources read within 6.5 h.
  2. Time-travel tests prove Stale beyond it.
  3. The production report runs and prints a verdict per source.
  4. The long page's last row and disclaimer are clickable and readable with the Ask control
     present (mobile and desktop).
  5. README statements match the repo (guard green).
- **Production-readiness mapping (PRD §23):** M1 advances items 3 (failure never a positive claim;
  already true [V]), 9 (stale cannot stay active) and 11 (backup/restore, via WP-06). Item 12
  (provider budget alerts) stays open — see D-7. The rest need the planner and are out of scope.

## 6. Copy-ready handoff prompts

### Lead agent (foundation)

```text
You are the foundation agent for PaxPivot (/Users/sherwyngraham/Projects/PaxPivot). Read AGENTS.md,
docs/agent/WORKFLOW.md, docs/agent/MERGE_POLICY.md, then this plan:
docs/plans/2026-09-14-reconciled-plan.md (start with its "Status" section; the essentials are
also below).

Milestone M1 "Trustworthy source watch". Work packages, in order:
WP-01 land floating-Ask CSS fix (TASK-039) → WP-02 README truth + guard fixes + task-status
normalization (TASK-040) → WP-03 derived source staleness (TASK-041) → WP-04 source reliability
report (TASK-042). WP-05 heartbeat / WP-06 off-host backup / WP-07 remove Redis only after the
owner answers D-4 / D-5 / D-6.

Critical context:
- The main checkout holds UNCOMMITTED finished work: apps/web/styles/{tokens,components}.css,
  apps/web/tests/shell.test.tsx (WP-01) and README.md + untracked tests/unit/test_docs_consistency.py
  (WP-02). Save patches first; build each PR in its own worktree from origin/main; never discard
  those local changes until the merged diff is confirmed identical.
- Verified defects to fix in WP-02: README says "six TASK-03* contracts" (there are nine; delete the
  count); test_blocked_claims_match_the_task_contracts has a no-op blocked branch and lacks the
  reverse direction; TASK-015 status is `review` but merged in 99ab982 (PR #22); TASK-033/036 point
  at AUDIT.md instead of TASK-032; TASK-035 is blocked only on owner confirming the traveler class;
  TASK-032 names migration 0004 (taken; next free is 0006).
- WP-03 rule: at read time in application/read_services.py, an observation in {fresh,
  no_departures_published, no_compatible_opportunity} older than 6h30m (strictly greater) is
  returned as source_stale with the stale explanation; stored observations never change; resolve
  `now` once per call and thread it; no schema/provider/web/API-shape change; document in
  docs/architecture/CONTRACTS.md.
- WP-04: pure reliability function + `python -m paxpivot.tooling source-report --days N`; verdict
  STOP if completion <90% or longest gap >18.5h, PASS if completion ≥95% and detection p95 ≤6.5h,
  else WATCH; exit 0/1/2; read-only.
- Never fetch/parse/hash/display the restricted 72-hour schedule artifacts. Repo is public.
- Commit, open PRs, merge and deploy ONLY as the product owner authorized for this run (decision
  D-8). If not authorized, stop at a pushed branch or local commit and report.
- Docker may be down: report make test-integration / migrate-check as "not run" rather than claim.

Report after each WP: PR link or branch, commands run with exit codes and test counts, what was not
run and why, task-file status line, and any deviation from this plan. Stop and ask on: any shared
contract change beyond ObservationReader, any infrastructure change, any owner decision.
```

### WP-01 (build agent)

```text
PaxPivot build task TASK-039 "floating Ask clearance". Repo /Users/sherwyngraham/Projects/PaxPivot.
Read AGENTS.md, docs/tasks/TASK_TEMPLATE.md, docs/tasks/SCREEN_TASK_RULES.md.
The fix already exists UNCOMMITTED in the main checkout: apps/web/styles/tokens.css (adds
--fab-height), apps/web/styles/components.css (.pp-main bottom padding and .pp-guarantee bottom
margin reserve nav + fab on mobile, fab on desktop), apps/web/tests/shell.test.tsx (regression test).
Do: save `git diff -- apps/web/styles apps/web/tests/shell.test.tsx` to a patch outside the repo;
create a worktree on build/TASK-039-floating-ask-clearance from origin/main; `make setup`; apply the
patch; write docs/tasks/TASK-039-floating-ask-clearance.md from the template. Touch nothing else
(not README.md, not tests/unit). Restore apps/web/next-env.d.ts if next rewrites it.
Prove: the shell test fails with the CSS change reverted and passes with it; `make format-check lint
typecheck test-unit build` exit 0; at document end, elementFromPoint over the Ask control's box hits
only non-interactive background at 320/390/420/768/1280 px widths, and there is no horizontal
overflow. Do NOT use bounding-box intersection mid-scroll (known false positive).
Commit/PR only if authorized; do not modify the main checkout. Report: branch/PR, commands and exit
codes, test counts, hit-test results per width, anything not run.
```

### WP-03 (foundation agent)

```text
PaxPivot foundation task TASK-041 "derived source staleness". Repo /Users/sherwyngraham/Projects/PaxPivot.
Read AGENTS.md, paxpivot.md SRC-007/SRC-008 (around line 221), apps/api/paxpivot/application/
read_services.py, application/source_explanation.py, tests/unit/test_read_services.py,
tests/unit/support_sources.py. Worktree from origin/main (after TASK-040 merges if it is in flight).
Problem (verified): infrastructure/providers/firecrawl.py writes state=fresh at retrieval; read
services pass it through; the web never derives state. A stopped cron shows "Fresh" forever.
Implement in read_services.py only:
  WINDOW = timedelta(hours=6, minutes=30)  # SRC-008
  success states {FRESH, NO_DEPARTURES, NO_COMPATIBLE}; if age > WINDOW (strictly) return a
  model_copy with state=STALE; else unchanged (future-dated counts as current).
  Resolve now = now or datetime.now(UTC) once in list_terminal_network / get_terminal_detail /
  list_source_health; thread to terminal_summary, health_row, evidence_read; build explanation
  from the effective observation; generated_at uses the same now.
No provider, schema, migration, API shape or web change. Add one paragraph to
docs/architecture/CONTRACTS.md: evidence `state` is the effective state at generated_at.
Tests first: 6h29m fresh; 6h30m fresh; 6h31m source_stale + stale explanation; unreachable at 10h
unchanged; future-dated unchanged; source-health counts use effective states; network headline and
terminal detail source rows carry effective state; fake repository items unchanged.
Gates: make format-check lint typecheck test-unit; make test-integration if Docker is up (else say
"not run"). Write docs/tasks/TASK-041-derived-source-staleness.md. Commit/PR/merge/deploy only as
authorized. Report: files, test names added, command exit codes and counts, anything not run.
```

### WP-04 (foundation agent; may run parallel to WP-03)

```text
PaxPivot foundation task TASK-042 "source reliability report". Repo /Users/sherwyngraham/Projects/PaxPivot.
Read AGENTS.md, paxpivot.md lines ~535-590 (source-health pass/stop metrics), apps/api/paxpivot/
tooling.py, application/ports/repositories.py, infrastructure/repositories.py, docs/DEPLOYMENT.md.
Worktree from origin/main after TASK-040 merges; rebase on TASK-041 before merge.
Build (read-only, no DB writes):
- apps/api/paxpivot/application/source_reliability.py (new): pure
  reliability(observations, cadence_minutes, window_start, now) -> SourceReliability with expected =
  floor(window/cadence), recorded, successful (retrieval succeeded), completion% capped 100, longest
  gap between successful reads (incl. window start→first and last→now), gaps>6.5h, hash changes,
  detection p95 upper bound (p95 of gaps preceding hash-changing reads; n/a if <2), verdict STOP if
  completion<90% or longest gap>18.5h, PASS if completion≥95% and p95≤6.5h or n/a, else WATCH.
- CLI `python -m paxpivot.tooling source-report [--days 30] [--now ISO]`; Makefile target
  source-report (DAYS var); enabled non-restricted sources; cadence NULL → "cadence unknown",
  excluded from verdict; first line states window and the assumption cron interval = cadence;
  exit 0 PASS/WATCH, 1 any STOP, 2 no observations.
- If ObservationReader lacks a ranged read, add one to the port + SQL repository (record it in the
  task file as a foundation contract addition).
- README Commands table row; DEPLOYMENT.md how-to-run on the VPS via `docker compose … exec -T api`.
Tests (tests/unit/test_source_reliability.py, new): perfect series PASS; one 13h gap WATCH; 20h gap
STOP; 85% STOP; cadence NULL excluded; zero observations exit 2; known hash-change gaps → expected p95.
Gates as usual; integration tests if the repository changed and Docker is up. Production run only
with deploy authorization; paste output into the Handoff. Report as usual.
```

### WP-02 (foundation; usually the lead does it)

Covered by the lead prompt. If handed off separately, reuse its "Verified defects to fix in WP-02"
paragraph plus the S-3 specification and WP-02 acceptance above.

### WP-05 / WP-06 / WP-07

Hand off only after D-4 / D-5 / D-6. Each prompt is its S-4 / S-5 / S-6 specification plus its
WP block, with the same reporting rules.

## 7. Completion tracking

| Requirement | WP / decision | Acceptance evidence |
|---|---|---|
| Unlanded CSS fix merged | WP-01 | PR merged, CI green, TASK-039 `done`, per-width hit-test table in Handoff |
| README true + guard enforced both ways | WP-02 | guard green on `main`; drift-injection log in TASK-040 Handoff |
| Task statuses name real blockers | WP-02 | TASK-015/032/033/035/036 status lines as in S-3 |
| Stale never shown as current (SRC-008) | WP-03 | time-travel tests; CONTRACTS.md paragraph; deployed tag recorded |
| 30-day gate computable | WP-04 | tests; first production report in TASK-042 Handoff |
| Failed run reaches a person | WP-05 / D-4 | monitor ping + test alert recorded, or D-4 declined recorded |
| Backup survives host loss | WP-06 / D-5 | off-host restore drill row counts, or declined |
| Unused infrastructure removed | WP-07 / D-6 | `make check` green, ADR, no redis container, or declined |
| Provider credits won't end the series | D-7 | owner note of plan/balance in TASK-042 Handoff |
| Permission path known | D-1 | written request sent + answer or 30-day timeout, recorded in a new ADR at M2 |
| Demand evidence | D-2 | session notes summary (no personal data in git) referenced in the M2 ADR |

**Milestone completion**

- **M1 complete:**
  - WP-01…WP-04 `done` with merge commits.
  - The API deployed with WP-03 + WP-04.
  - One production report recorded.
  - D-4 / D-5 / D-6 each resolved as done or declined.
- **M2 complete:** an ADR at the next free number chooses Path A, B or C, citing the D-1 answer,
  the D-2 summary, and a `source-report` covering ≥ 30 days.
- **This plan complete:** M1 and M2 complete. The chosen path then gets its own plan; do not
  pre-build it.

---

## Appendix — inspection log

- **Read:**
  - `git status` / `log`; all 38 task status lines; `AUDIT.md`; `IMPROVEMENT_LOG.md`
  - the uncommitted diff and `README.md`; `tests/unit/test_docs_consistency.py`
  - `application/read_services.py`; `domain/source.py` (`SourceState`); the
    `providers/firecrawl.py` state assignment; `api.py` routes; migration file list
  - PRD §3, §9.4, Milestones A–G, §23–24; `paxpivot.md` SRC-007/008, ELG-001…005 and the
    source-health metrics
  - `docs/DEPLOYMENT.md`; `docs/agent/WORKFLOW.md` §7; `AGENTS.md`; `compose.prod.yml`;
    the trip detail page; the seeded terminals (JB MDL, Dover, BWI, Andrews)
  - `web/lib/presentation/source-state.ts`; the validation review HTML
- **Ran:**
  - `make test-unit` → 261 passed (Python), 339 passed across 25 web files.
  - Bare `pytest tests/unit/test_docs_consistency.py` from the repo root → `OSError` on the
    `CLAUDE.md` symlink.
  - `curl` public `/health` and `/ready` → 307 to `/login`.
  - `docker info` → daemon down.
- **Not done:** signed-in UI walk-through; production DB queries; integration and migration gates;
  lint / typecheck / build re-run; full P3 document; validation synthesis `report.md`.
