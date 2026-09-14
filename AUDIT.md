# PaxPivot — Production audit (2026-09-14, main @ 25f1264)

> Supersedes the 2026-09-11 snapshot kept in git history. Evidence comes from:
> - three read-only audit passes (feature completeness, security and operations, code quality);
> - a live read-only inspection of the pilot VPS.
>
> Execution is logged in [IMPROVEMENT_LOG.md](IMPROVEMENT_LOG.md), Run 4. Decisions and their
> history live in [docs/plans/2026-09-14-reconciled-plan.md](docs/plans/2026-09-14-reconciled-plan.md).
> Labels: **fact** = verified in code, command output or on the host; **judgment** = an assessment.

## 1. Executive summary

**Health grade: B.** Engineering quality is A-. Product completeness is about half of the PRD's
pilot scope.

**Live and working.** Everything below is deployed at `paxpivot.qcs-cargo.com`:
- sign-in;
- the terminal network with honest source states;
- source health and trip requests;
- the 30-day source reliability report;
- nightly on-host backups;
- the web container healthcheck (TASK-043, deployed 2026-09-14).

The four AMC terminal pages are checked every 6 h. All four read `fresh` at 12:00 UTC on
2026-09-14 (fact, `checks.log`).

**Quality is strong** (all fact):
- 283 Python unit tests, with 74 % statement coverage and ~100 % on domain/application;
- 40 integration tests and 341 web tests with axe checks;
- `mypy --strict`, and no `as any` or `@ts-ignore` anywhere;
- a README drift guard;
- CI that `make check` reproduces locally.

**Not working.** Route search, eligibility, profile/readiness, alerts, Ask PaxPivot and the
commercial handoff are honest empty states.

**Top 3 risks**
1. There is no off-host backup. Losing the VPS loses all history. Owner decision D-5.
2. Nothing alerts a person when checks or the site stop. Owner decision D-4.
3. The only published departure data is in CUI-marked 72-hour artifacts. They cannot be processed
   without written permission (D-1, requested 2026-09-14), so no screen can show departures.

**Top 3 opportunities**
1. The eligibility engine and traveler profile. They are unblocked now that D-3 is confirmed.
2. An interim planner that needs no departure data: terminals to check, terminal operating facts,
   and a commercial handoff.
3. Cheap hardening:
   - a login rate limit and same-origin POST checks;
   - container limits and least privilege;
   - CI dependency and image gates, which also close a critical dev-only vitest CVE.

## 2. Repo map

**Purpose.** An end-to-end Space-A journey planner. It is a single-user pilot for a Category VI
sponsor with a minor dependent, on CONUS-to-CONUS trips. PRD:
[PAXPIVOT_PRODUCTION_PRD.md](PAXPIVOT_PRODUCTION_PRD.md). Safety baseline: [paxpivot.md](paxpivot.md).

**Stack**
- **Web:** `apps/web`, Next.js 16.3.4 and React 19, with server components and a signed session cookie.
- **API:** `apps/api`, FastAPI 0.135, SQLAlchemy Core and Alembic.
- **Data:** Postgres 16 with PostGIS. Redis is deployed but unused.
- **Retrieval:** the Firecrawl provider.
- **Tooling:** one `Makefile`, and the CI workflow `Quality` with job `scaffold`.

```text
browser ─TLS─ Traefik (shared, Dokploy) ─ web :3000 ─bearer─ api :8000 ─ Postgres
host cron 00/06/12/18 UTC ─ api tooling check-sources ─ Firecrawl ─ source_observations (append-only)
host cron 03:15 UTC ─ pg_dump ─ /opt/paxpivot/backups (on-host only)
```

**Key directories**
- `apps/api/paxpivot/domain`: pure contracts. Imports only stdlib and pydantic (fact).
- `apps/api/paxpivot/application`: read services, source checks, the reliability report, the
  trip service and parsers.
- `apps/api/paxpivot/infrastructure`: SQL repositories, the Firecrawl provider, bootstrap seed
  data and auth.
- `apps/web/app`: routes. `lib/presentation` holds adapters and screen models; `components` holds
  the UI.
- `deploy/`, `compose.prod.yml`: production topology on the VPS.
- `docs/tasks`, `docs/decisions`, `docs/plans`: one task file per PR, ADRs, and the plan.

**Surprises**
- The VPS is shared with roughly 70 containers from other projects (fact).
- Traefik still answers 404 for about 2 s after `up --wait` reports web healthy (fact, 2026-09-14
  deploy).
- Redis and `rq` are deployed and imported by nothing (fact).
- TASK-035's recorded blocker was already satisfied by the owner's D-3 answer.

## 3. Audit report

### 3.1 Product completeness (fact unless marked)

| Area | Status | Evidence | Blocker if not done |
|---|---|---|---|
| Sign-in, sessions, open-redirect guard | Live | `apps/web/lib/auth/*`, `apps/web/tests/auth.test.ts` | — |
| Terminal network, detail, source health | Live | `apps/web/app/terminals/**`, `apps/web/app/advanced/page.tsx` | — |
| Trip requests (create, list, view) | Live | `api.py:184-212`, `apps/web/app/trips/**` | — |
| Trip page "routes" section | Empty state | `apps/web/app/trips/[tripId]/page.tsx:50-53` | Buildable: TASK-044 |
| Terminal operating facts (hours, phone, parking) | Read path built, no producer | `read_services.py:139-166`; `bootstrap.py:1-11` seeds none | Buildable: TASK-048 |
| Traveler/party profile | Contracts only | `domain/eligibility.py:10-34` | Buildable: TASK-050 |
| Eligibility engine (ELG-001..005) | Contracts only | `domain/eligibility.py:37-43`; TASK-035 | Buildable (D-3 yes); matrix needs owner approval (PRD §23 item 15) |
| Readiness guidance (ELG-004/005) | Empty state | `apps/web/app/profile/readiness/page.tsx` | Buildable: TASK-052 |
| Commercial handoff (COM-001..004) | Not started | no code | Buildable: TASK-053 |
| In-app alerts on source-state change | Empty state | `apps/web/app/alerts/page.tsx` | Buildable: TASK-054 |
| Trip delete | Not started | no route | Buildable: TASK-055 |
| Schedule parser, published departures, route cards (TASK-032/033/036) | Blocked | TASK-032 status | D-1 written permission |
| Verified terminal entrances, maps | Engine built, no data | `bootstrap.py:131` (`entrance=None`) | Needs human-verified entrance coordinates (judgment: not inferable from pages) |
| Destination resolver, origin catchment | Not started | — | Geocoding (Q-1) and routing (Q-2) provider accounts |
| Ask PaxPivot tools and LLM | Shell only | `apps/web/app/ask/page.tsx` | LLM provider account, and route results to ground on |
| Notification email | Not started | — | Email provider account (Resend) |
| Historical aggregates | Not started | — | 30-day window (not before 2026-10-11) plus D-1 |
| Boarding probabilities | Prohibited | PRD §16 | Prediction gate |
| Multi-user accounts | Not started | ADR-005 | Owner decision to go beyond the single pilot |

### 3.2 Security (sorted by severity)

- **Medium · 3×S — Login has no brute-force limit.** There is only a fixed 500 ms delay per
  request (`apps/web/app/auth/session/route.ts:11,27-31`). Parallel guessing pays nothing extra
  (fact). ADR-005 accepted this for a local pilot; the pilot is now internet-facing (judgment).
- **Low · 2×S — No Origin / Sec-Fetch-Site check on the POST handlers** (`/auth/session`,
  `/auth/logout`, `/trips/new`). SameSite=Lax is the only CSRF defence (fact).
- **Low · 2×S — No body size limit on those handlers.** Next's `bodySizeLimit` does not apply to
  Route Handlers (fact).
- **Low · 2×S–M — The CSP is only `frame-ancestors 'none'`** (`apps/web/next.config.ts:5-18`). It
  does not constrain scripts (fact).
- **Low · 2×M — API reads use the full-privilege DB role.** Transactions are `READ ONLY`
  (TASK-027 follow-up; fact).
- **Healthy (fact)**
  - Auth: timing-safe comparisons, `HttpOnly; Secure; SameSite=Lax` cookies, fail-closed config.
  - Exposure: the API is bearer-only and not published on the host. No CORS and no OpenAPI
    endpoints. Errors return allowlisted message keys only.
  - Secrets: every secret is `:?`-guarded, and none is in git history. PRV-003 logging is
    respected (`hide_parameters=True`).
  - Headers: HSTS, nosniff, `X-Frame-Options: DENY`, referrer policy, permissions policy.
  - Dependencies: `pnpm audit --prod` = 0 and `pip-audit` = 0 production vulnerabilities.

### 3.3 Operations

- **Critical · 5×M — No off-host backup copy** (`docs/DEPLOYMENT.md`, D-5). Owner credentials are
  needed (fact).
- **High · 4×S — No alerting when checks stop or the site is down** (D-4). The public `/health`
  and `/ready` answer 307 → `/login` (fact).
- **Medium · 4×S — No container resource limits** in `compose.prod.yml`, on a host shared with
  other apps (fact).
- **Medium · 3×S — No `cap_drop` or `no-new-privileges`** on any service (fact).
- **Medium · 3×S — Cron entries exist only on the host**
  (`/etc/cron.d/paxpivot-{checks,backup}`), not in git (fact).
- **Medium · 3×S — The deploy runbook says `/login` answers 200 immediately after `up --wait`.**
  On 2026-09-14 it did not, and a one-shot check rolled back a good deploy (fact).
- **Low · 2×S** (all fact):
  - no pre-deploy `pg_dump` step, although downgrades are forbidden;
  - restore was tested only once;
  - about 12 old images sit on the host.
- **Not a gap:** Docker log rotation is already set host-wide (`/etc/docker/daemon.json`:
  json-file, 10m × 3; fact). An explicit compose block is still wanted for portability.

### 3.4 Code quality, testing, performance, dependencies, DevEx, documentation

- **High · 4×S — `vitest` 4.0.18 has GHSA-5xrq-8626-4rwp** (critical) and GHSA-82fw-gwwq-j7x9
  (moderate). It is dev-only and the UI server is not used (fact). The fix is ≥ 4.1.11.
- **High · 4×S — CI has no dependency audit gate.** That is how the CVE above went unflagged
  (fact).
- **High · 4×S — CI never builds the deployable Docker images** (`.github/workflows/quality.yml`;
  fact).
- **Medium · 3×S — `make compose-check` validates only the dev `compose.yml`.**
  `compose.prod.yml` is never checked (fact).
- **Medium · 3×S — Redis/rq are unused but deployed** (`pyproject.toml:5`, `compose.prod.yml`;
  D-6; fact).
- **Low · 3×S — No coverage threshold.** Judgment: not needed yet.
- **Low · 2×M — No end-to-end browser tests.** A Playwright leftover remains in `.gitignore`
  (fact).
- **Low · 2×S — N+1 in `list_terminal_network`** (`read_services.py:121-136`), and no
  `sources.terminal_id` index. Invisible at 4 terminals (fact).
- **Low · 2×S — `application/corpus.py` imports the concrete Firecrawl provider** instead of the
  port. It is an offline CLI only (fact).
- **Healthy (fact)**
  - Layering: domain has no framework coupling, and web components never import adapters.
  - Error handling: 3 broad `except` sites, none swallowing.
  - Tests: they assert behaviour, including boundary tables and a secret-leak check.
  - Documentation: the README versions, route table and migration range are exact.

### 3.5 Strengths to preserve

- **Honest by construction:** unknown, stale and restricted states stay visible, and source
  failure never reads as "no flights".
- **A policy gate** sits in front of every processing step. The restricted artifacts allow
  nothing, down to a database CHECK.
- **Append-only observations** with provenance.
- **Delivery discipline:** one task file per PR, fresh-review records and a strict branch
  protection gate.

## 4. Improvement strategy

1. **Safe to leave running.**
   - *Target:* the live pilot tolerates abuse, resource spikes and a host rebuild.
   - *Principle:* defaults a single operator never has to remember.
   - *Done when:*
     - login returns 429 after repeated failures;
     - cross-site POSTs return 403;
     - every service has memory and CPU limits and dropped capabilities;
     - the cron entries are installed from `deploy/cron`;
     - CI fails on a vulnerable production dependency, a broken Dockerfile or an invalid
       production compose file.
   - *Not now:*
     - read-only root filesystems (needs a tmpfs audit per service);
     - a SELECT-only DB role;
     - a nonce-based CSP;
     - Traefik middleware (shared host).
2. **A useful interim planner without departure data.**
   - *Target:* for a saved trip, the pilot sees which terminals to check, how current each is, the
     terminal's own published operating facts, and a labelled commercial fallback.
   - *Principle:* PRD §4.3 honest absence. Never "no flights", never a probability.
   - *Done when:*
     - `/trips/{id}` lists terminals with state, page time and links;
     - terminal detail shows published hours and phone with provenance;
     - the commercial card carries the mandatory handoff label.
   - *Trade-off:* no ranking and no drive times until providers and verified entrances exist.
3. **Eligibility for the pilot class.**
   - *Target:* a stored party (sponsor plus dependent, no sensitive data) gets a versioned, cited
     decision on its trips and on Profile. It comes with readiness guidance, including the
     dependent-document conflict warning.
   - *Principle:* rules are data (PRD §8); unknown stays unknown.
   - *Done when:* CONUS→CONUS returns `eligible` with DoDI 4515.13 Change 7 citations; unlisted
     geography is never inferred; the ELG-005 conflict stays unresolved and visible.
   - *Gate:* the owner approves the matrix. Until then the decision reads `unknown` with that
     reason.
4. **Honest boundaries.** Blocked features are documented with what unblocks them. They are not
   faked. *Done when:* §6 and §7 name every one.

## 5. Task plan

Every task gets its own PR, a fresh-review record with 0 Critical / 0 Important, CI `scaffold`
green, a merge, and a deploy. Execute-now = yes for everything in M0–M2.

| ID | Milestone | Title | Effort | Impact | Risk | Deps | Execute now |
|---|---|---|---|---|---|---|---|
| TASK-043 | M1 | Web container healthcheck | S | 3 | low | — | done (PR #52, deployed 25f1264) |
| TASK-047 | M0 | CI and dependency gates (vitest fix, audits, image builds, prod compose validation) | S | 4 | low | — | yes |
| TASK-046 | M1 | Web request hardening (login rate limit, same-origin POSTs, body limits) | S–M | 4 | medium (auth path) | — | yes |
| TASK-045 | M1 | Container and ops hardening (limits, least privilege, cron as code, heartbeat hook, runbook) | S–M | 4 | medium (prod topology) | — | yes |
| TASK-044 | M2 | Terminals to check on the trip page | S | 4 | low | — | yes |
| TASK-048 | M2 | Terminal operating facts from the approved terminal pages | S–M | 4 | low | — | yes |
| TASK-049 | M2 | This audit and IMPROVEMENT_LOG Run 4 | S | 3 | none | — | yes |
| TASK-050 | M2 | Private traveler/party profile API (ADR-009, migration 0006) | M | 4 | medium (privacy) | — | yes |
| TASK-035 | M2 | Eligibility engine v1 (ADR-007) | M | 5 | medium | TASK-050, matrix approval | yes |
| TASK-051 | M2 | Party and eligibility on the trip and Profile screens | S–M | 4 | low | TASK-035 | yes |
| TASK-052 | M2 | Readiness guidance and document-conflict acknowledgement | S | 4 | low | TASK-050 | yes |
| TASK-053 | M2 | Commercial baseline handoff (COM-001..004) | S | 4 | low | TASK-044 | yes |
| TASK-054 | M2 | In-app alerts on source-state change | M | 3 | low | — | yes |
| TASK-055 | M2 | Trip delete | S | 3 | low | — | yes |
| — | M3 | Read-only rootfs; SELECT-only DB role; nonce CSP; coverage threshold; e2e; `sources.terminal_id` index; corpus port | S–M each | 2–3 | — | — | no |

**Quick wins:** TASK-047 (a one-line CVE fix plus gates); the TASK-045 limits and caps; the
TASK-046 same-origin check.

**Top 3 sketches**
- **TASK-046**
  - One request-guard helper is used by the three POST handlers:
    - it rejects `Sec-Fetch-Site` other than same-origin, and a mismatched `Origin` host, with 403;
    - it rejects a missing or oversized `Content-Length` with 413;
    - it keeps an in-memory per-client failure window plus a global ceiling, and returns 429.
  - *Gotcha:* the client IP sits behind one Traefik hop that appends to `X-Forwarded-For`. Use the
    right-most entry, because clients can forge the prefix.
- **TASK-050 → TASK-035**
  - Profile tables hold only role, category attestation, age band and accompaniment. There are no
    columns for SSN, ID numbers, medical data or a full birth date (PRV-001 enforced by absence).
  - The engine reads versioned `policy_versions` and `eligibility_rules` rows seeded from the
    reviewed matrix.
  - `decide_eligibility(party, policy)` returns state, citations and unresolved conditions.
  - *Gotcha:* in the extracted PDF table, Item 47's non-CONUS grid cells conflict with its
    narrative. Encode them as `unknown`, not denied.
- **TASK-053**
  - A web-only link builder from the trip window and destination text to a prefilled Google
    Flights search.
  - It shows the airports, dates and party for the user to verify, and a plain-search fallback
    labelled `prefill failed`.
  - The mandatory label says availability and fare are unknown. No fare is ever stored or shown
    (COM-002).
  - *Gotcha:* the origin airport. There are no terminal coordinates, so use a curated per-terminal
    nearby-airport list marked as curated, and let the user change it.

## 6. Open questions (need the product owner or the host operator)

1. **Eligibility matrix approval** (PRD §23 item 15). The draft for DoDI 4515.13 Change 7, Table 3
   Item 47 (confirmed current on 2026-09-14) has five rows:
   - CONUS→CONUS: sponsor yes; dependent yes only when accompanied.
   - CONUS↔AK/HI/PR/USVI/Guam/AS and within AK/HI/PR/USVI: `unknown`. The item's narrative text
     allows them, but the extracted grid cells are blank. A person should check the PDF page
     visually.
   - Northern Mariana Islands, and any unlisted pairing: no.
2. **D-4 — heartbeat.** A free dead-man monitor URL. TASK-045 prepares the hook.
3. **D-5 — off-host backups.** An object storage bucket or an owner machine, plus credentials.
4. **D-6 — Redis/rq.** Remove it until a worker exists?
5. **D-7 — Firecrawl.** Credit balance, and whether the key was rotated.
6. **D-1 — permission.** Has the written request been sent, and has an answer arrived? No answer
   within 30 days means user-open-only.
7. **Provider accounts.** Geocoding (Q-1), ground routing (Q-2), an LLM for Ask PaxPivot, and
   email (Resend).
8. **Verified terminal entrance coordinates.** Who verifies them?
9. **Shared Traefik.** The minimum TLS version and certificate-expiry monitoring belong to the host
   operator.
10. **D-2.** Traveler sessions are still open; the owner chose "where to go to fly" as the first job.

## 7. Post-execution status

Updated as each task merges and deploys.

| Task | Status | Evidence |
|---|---|---|
| TASK-040 → done | Done | PR #51 (df0723d); post-merge Quality green |
| TASK-043 web healthcheck | Done, deployed | PR #52 (25f1264); VPS `/ready` 200, `/login` 200, web healthy |
| TASK-044…055, TASK-035 | In progress | See the task table in §5 |
