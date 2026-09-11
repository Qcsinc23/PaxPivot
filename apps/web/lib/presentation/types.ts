/**
 * Presentation (view-model) contracts consumed by `components/paxpivot/*`.
 *
 * Boundary rule (docs/architecture/UI_FOUNDATION.md): every decision — freshness,
 * eligibility, ranking, compatibility, tiering, historical interpretation — is made by the
 * application/API and arrives here as data. Components render these shapes; they do not
 * compute from raw domain records. Display strings are pre-formatted by the adapter that
 * builds the view model; ISO timestamps travel alongside for `<time>` semantics.
 */
import type { Fact } from "./fact";
import type { SourceStateCode, StatusTone } from "./source-state";

export type { Fact } from "./fact";
export type { SourceStateCode, StatusTone } from "./source-state";

export type Href = string;

/** Source evidence as shown on any card: authoritative code plus optional display age. */
export type SourceEvidenceView = {
  state: SourceStateCode;
  /** e.g. "14m" — pre-formatted by the application; omitted when no read time exists. */
  ageText?: string;
  /** Full deterministic explanation (TASK-002 `explain_source`), shown on demand. */
  explanation?: string;
};

/** Source time vs read time, kept separate (pilot SRC-008). */
export type EvidenceAgeView = {
  sourceTime: Fact<{ iso: string; text: string }>;
  observedAt: { iso: string; text: string };
  ageText: Fact<string>;
};

export type SourceLedgerRowView = {
  id: string;
  name: string;
  evidence: SourceEvidenceView;
  detail?: string;
  href?: Href;
};

export type RankingSortMode =
  | "recommended"
  | "fastest"
  | "lowest_known_cost"
  | "fewest_handoffs";

export const SORT_MODE_LABELS: Readonly<Record<RankingSortMode, string>> = {
  recommended: "Recommended",
  fastest: "Fastest",
  lowest_known_cost: "Lowest known cost",
  fewest_handoffs: "Fewest handoffs",
};

export type FactView = { label: string; value: Fact<string> };

/** Why a Space-A route card sits where it does. Position is 1-based within Space-A results. */
export type RouteHeadline =
  | { kind: "best_space_a" }
  | { kind: "space_a_candidate"; position: number };

export type RouteCardView = {
  id: string;
  headline: RouteHeadline;
  title: string;
  subtitle?: string;
  evidence: SourceEvidenceView;
  /** Application-supplied attention pill, e.g. an unresolved seat state. */
  attention?: { label: string; tone: StatusTone };
  knownCost: Fact<string>;
  facts: readonly FactView[];
  /** First decisive comparator field, in one line (PRD §7.3). */
  rankingReason: string;
  unresolved?: string;
  actions: { viewHref: Href; watchHref?: Href };
};

/** Commercial baseline/fallback: a provider handoff, never a PaxPivot fare or booking. */
export type CommercialBaselineView = {
  id: string;
  headline: "safest_overall" | "fallback";
  title: string;
  subtitle?: string;
  quote: Fact<string>;
  quoteEvidence?: SourceEvidenceView;
  facts: readonly FactView[];
  rankingReason: string;
  actions: { openHref: Href; watchHref?: Href };
};

export type JourneyLegKind =
  | "ground"
  | "readiness"
  | "space_a"
  | "commercial"
  | "handoff"
  | "user_confirmed";

export type JourneyLegView = {
  id: string;
  kind: JourneyLegKind;
  title: string;
  detail?: string;
  time: Fact<string>;
  /** What this leg's timing depends on; drives the dashed connector, never a probability. */
  dependency: "none" | "space_a" | "provider";
};

export type MapMarkerKind = "origin" | "terminal" | "destination" | "airport";

export type MapMarkerView = {
  id: string;
  label: string;
  kind: MapMarkerKind;
  tone: StatusTone | "self";
  /** Non-colour meaning for the marker, e.g. "Fresh · 47 min drive". */
  statusText: string;
  coordinates: Fact<{ latitude: number; longitude: number }>;
  href?: Href;
};

export type MapView = {
  title: string;
  status: "ready" | "loading" | "empty" | "error";
  markers: readonly MapMarkerView[];
  /** e.g. "Basemap not loaded" — shown on the surface, provided by the application. */
  note?: string;
};

export type TerminalCardView = {
  id: string;
  name: string;
  installation?: string;
  accessText: Fact<string>;
  evidence: SourceEvidenceView;
  entrance: { status: "verified" | "unverified"; label: Fact<string> };
  href: Href;
};

export type ReadinessItemView = {
  id: string;
  title: string;
  detail?: string;
  status: "done" | "due" | "unresolved" | "pending";
  dueText?: string;
  explanation?: string;
};

export type AlertKind = "route_order" | "source" | "readiness" | "opportunity";

export type AlertRowView = {
  id: string;
  kind: AlertKind;
  tone: StatusTone;
  title: string;
  detail: string;
  when: { iso: string; text: string };
  action: { label: string; href: Href };
};

export type TripCardView = {
  id: string;
  name: string;
  windowText: string;
  partyText: string;
  change?: { label: string; tone: StatusTone };
  top?: {
    headline: RouteHeadline | "safest_overall";
    title: string;
    evidence: SourceEvidenceView;
  };
  sources: readonly { evidence: SourceEvidenceView; count: number }[];
  href: Href;
};

export type EvidenceRowView = {
  id: string;
  label: string;
  value: Fact<string>;
  tone?: StatusTone;
  href?: Href;
};

/** Factual history only (PRD §10.2). No rate, likelihood or "useful" wording. */
export type HistoricalSummaryView = {
  observed: Fact<number>;
  successfulChecks: Fact<number>;
  periodText: string;
  sinceLastText: Fact<string>;
  medianSeats: Fact<{ value: number; sampleSize: number }>;
  coverageNote: string;
  methodologyHref?: Href;
};

/** Traveler-facing eligibility summary; category detail stays under Profile/evidence. */
export type EligibilitySummaryView = {
  state: "eligible" | "ineligible" | "unknown" | "outside_supported_scope";
  travelerCount: number;
  detailHref?: Href;
};
