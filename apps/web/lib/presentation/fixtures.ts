/**
 * Synthetic, clearly fictional view-model fixtures for tests and the development showcase.
 *
 * Nothing here is a real terminal, fare, time or traveler, and none of these values may be
 * hard-coded into a production component. Production screens receive view models from the
 * application layer.
 */
import { known, unknown } from "./fact";
import type {
  AlertRowView,
  AskAnswerView,
  CommercialBaselineView,
  EvidenceAgeView,
  EvidenceRowView,
  HistoricalSummaryView,
  JourneyLegView,
  MapView,
  ReadinessItemView,
  RouteCardView,
  SourceLedgerRowView,
  TerminalCardView,
  TripCardView,
} from "./types";

const SYNTHETIC_EXPLANATION =
  "Synthetic fixture explanation. In production this text is the deterministic source-state explanation supplied by the application.";

export const fixtureRoute: RouteCardView = {
  id: "route-fixture-1",
  headline: { kind: "best_space_a" },
  title: "Example Terminal A → Example Terminal B",
  subtitle: "Day 2 · 2 travelers",
  evidence: {
    state: "fresh",
    ageText: "9m",
    explanation: SYNTHETIC_EXPLANATION,
  },
  knownCost: known("$10"),
  facts: [
    { label: "Space-A leg", value: known("1") },
    { label: "Handoffs", value: known("2") },
    { label: "Drive", value: known("35 min") },
    { label: "Fallback", value: known("Yes") },
  ],
  rankingReason: "Freshest evidence and both ground legs solved.",
  unresolved: "Whether seats are released; decided in person at the terminal.",
  actions: { viewHref: "/showcase#route", watchHref: "/showcase#watch" },
};

export const fixtureCandidate: RouteCardView = {
  id: "route-fixture-2",
  headline: { kind: "space_a_candidate", position: 2 },
  title: "Example Terminal C → Example Terminal B",
  subtitle: "Day 3",
  evidence: {
    state: "source_stale",
    ageText: "3d",
    explanation: SYNTHETIC_EXPLANATION,
  },
  attention: { label: "Seat state unresolved", tone: "caution" },
  knownCost: unknown("Cost not published"),
  facts: [
    { label: "Drive", value: known("1 h 55") },
    { label: "Arrival", value: unknown() },
    { label: "Late ride", value: unknown("Provider supply unknown") },
  ],
  rankingReason: "Ranked below: evidence is stale.",
  actions: { viewHref: "/showcase#route-2" },
};

export const fixtureCommercial: CommercialBaselineView = {
  id: "commercial-fixture-1",
  headline: "safest_overall",
  title: "Example Airport → Example City, commercial",
  quote: known("from $999"),
  quoteEvidence: { state: "fresh", ageText: "4m" },
  facts: [
    { label: "Door to door", value: known("12 h 30") },
    { label: "Handoff", value: known("1") },
    { label: "Space-A legs", value: known("None") },
  ],
  rankingReason: "Nothing here depends on a seat call; you book it yourself.",
  actions: { openHref: "/showcase#commercial", watchHref: "/showcase#watch" },
};

export const fixtureLegs: readonly JourneyLegView[] = [
  {
    id: "leg-1",
    kind: "ground",
    title: "Leave origin",
    detail: "35 min drive · verified entrance",
    time: known("02:00"),
    dependency: "none",
  },
  {
    id: "leg-2",
    kind: "readiness",
    title: "Seat call at the counter",
    detail: "In person · seat state as published",
    time: known("06:00"),
    dependency: "space_a",
  },
  {
    id: "leg-3",
    kind: "space_a",
    title: "Fly to Example Terminal B",
    detail: "Duration as published",
    time: known("09:00"),
    dependency: "none",
  },
  {
    id: "leg-4",
    kind: "handoff",
    title: "Ride to destination",
    detail: "Provider supply unknown",
    time: unknown(),
    dependency: "provider",
  },
];

export const fixtureMap: MapView = {
  title: "Example journey map",
  status: "ready",
  note: "Basemap not loaded in showcase",
  markers: [
    {
      id: "m-origin",
      label: "You",
      kind: "origin",
      tone: "self",
      statusText: "Origin",
      coordinates: known({ latitude: 40.0, longitude: -74.0 }),
    },
    {
      id: "m-a",
      label: "Example Terminal A",
      kind: "terminal",
      tone: "verified",
      statusText: "Fresh · 35 min drive",
      coordinates: known({ latitude: 40.1, longitude: -74.5 }),
      href: "/showcase#terminal",
    },
    {
      id: "m-c",
      label: "Example Terminal C",
      kind: "terminal",
      tone: "caution",
      statusText: "Stale · 1 h 55 drive",
      coordinates: known({ latitude: 39.1, longitude: -75.4 }),
    },
    {
      id: "m-d",
      label: "Example Terminal D",
      kind: "terminal",
      tone: "unknown",
      statusText: "Unavailable · location unknown",
      coordinates: unknown(),
    },
    {
      id: "m-b",
      label: "Example Terminal B",
      kind: "destination",
      tone: "verified",
      statusText: "Destination terminal",
      coordinates: known({ latitude: 21.3, longitude: -157.9 }),
    },
  ],
};

export const fixtureTerminal: TerminalCardView = {
  id: "terminal-fixture-a",
  name: "Example Terminal A",
  installation: "Example Joint Base",
  accessText: known("35 min drive"),
  evidence: {
    state: "fresh",
    ageText: "9m",
    explanation: SYNTHETIC_EXPLANATION,
  },
  entrance: { status: "verified", label: known("Gate 1 (example)") },
  href: "/showcase#terminal",
};

export const fixtureTerminalUnverified: TerminalCardView = {
  id: "terminal-fixture-d",
  name: "Example Terminal D",
  accessText: unknown("Drive time not computed"),
  evidence: { state: "source_unreachable", explanation: SYNTHETIC_EXPLANATION },
  entrance: { status: "unverified", label: unknown() },
  href: "/showcase#terminal-d",
};

export const fixtureEvidenceAge: EvidenceAgeView = {
  sourceTime: known({ iso: "2026-01-01T14:02:00Z", text: "14:02Z" }),
  observedAt: { iso: "2026-01-01T15:44:00Z", text: "15:44Z" },
  ageText: known("9m"),
};

export const fixtureEvidenceAgeUnknownSource: EvidenceAgeView = {
  sourceTime: unknown("Page shows no timestamp"),
  observedAt: { iso: "2026-01-01T15:44:00Z", text: "15:44Z" },
  ageText: known("9m"),
};

export const fixtureEvidenceRows: readonly EvidenceRowView[] = [
  { id: "e-seat", label: "Seat state, as published", value: known("“TBD”") },
  {
    id: "e-party",
    label: "Applies to your party",
    value: known("Yes"),
    tone: "verified",
  },
  { id: "e-reader", label: "Reader", value: known("v0 (example) · validated") },
  {
    id: "e-rev",
    label: "Revision history",
    value: unknown("No prior observation"),
  },
];

export const fixtureLedger: readonly SourceLedgerRowView[] = [
  {
    id: "s-a",
    name: "Example Terminal A",
    evidence: {
      state: "fresh",
      ageText: "9m",
      explanation: SYNTHETIC_EXPLANATION,
    },
    detail: "Read cleanly",
  },
  {
    id: "s-c",
    name: "Example Terminal C",
    evidence: {
      state: "source_stale",
      ageText: "3d",
      explanation: SYNTHETIC_EXPLANATION,
    },
    detail: "No clean read for 3 days",
  },
  {
    id: "s-d",
    name: "Example Terminal D",
    evidence: {
      state: "source_unreachable",
      explanation: SYNTHETIC_EXPLANATION,
    },
    detail: "Connection refused",
  },
  {
    id: "s-e",
    name: "Example Terminal E",
    evidence: {
      state: "restricted_user_open_only",
      explanation: SYNTHETIC_EXPLANATION,
    },
    detail: "You open this one",
    href: "https://example.invalid/terminal-e",
  },
];

export const fixtureReadiness: readonly ReadinessItemView[] = [
  {
    id: "r-1",
    title: "Sponsor travelling with you",
    status: "done",
    explanation: "Synthetic policy note.",
  },
  { id: "r-2", title: "Party size applied to every search", status: "done" },
  {
    id: "r-3",
    title: "Sign up at the terminal",
    detail: "In person only",
    status: "due",
    dueText: "Due day 1",
  },
  {
    id: "r-4",
    title: "Choose a late-arrival plan",
    detail: "Ride supply after 23:00 unknown",
    status: "unresolved",
  },
];

export const fixtureAlerts: readonly AlertRowView[] = [
  {
    id: "a-1",
    kind: "route_order",
    tone: "caution",
    title: "Route order changed",
    detail: "Example Terminal C slipped below Example Terminal D",
    when: { iso: "2026-01-01T13:00:00Z", text: "2h" },
    action: { label: "View", href: "/showcase#route" },
  },
  {
    id: "a-2",
    kind: "source",
    tone: "verified",
    title: "Example Terminal D reachable again",
    detail: "First clean read since yesterday",
    when: { iso: "2026-01-01T10:00:00Z", text: "5h" },
    action: { label: "Open", href: "/showcase#terminal-d" },
  },
  {
    id: "a-3",
    kind: "readiness",
    tone: "caution",
    title: "Readiness due tomorrow",
    detail: "Sign up at the terminal",
    when: { iso: "2025-12-31T15:00:00Z", text: "1d" },
    action: { label: "Do it", href: "/showcase#readiness" },
  },
];

export const fixtureTrip: TripCardView = {
  id: "trip-fixture-1",
  name: "Example City",
  windowText: "Day 1–8",
  partyText: "2 travelers",
  change: { label: "Order changed", tone: "caution" },
  top: {
    headline: { kind: "best_space_a" },
    title: "Example Terminal A → Example Terminal B",
    evidence: { state: "fresh", ageText: "9m" },
  },
  sources: [
    { evidence: { state: "fresh" }, count: 2 },
    { evidence: { state: "source_stale" }, count: 1 },
  ],
  href: "/showcase#trip",
};

export const fixtureHistory: HistoricalSummaryView = {
  observed: known(11),
  successfulChecks: known(90),
  periodText: "last 90 days",
  sinceLastText: known("8 days"),
  medianSeats: known({ value: 18, sampleSize: 9 }),
  coverageNote:
    "Counts include checks that failed or read no departures. Not a forecast.",
  methodologyHref: "/showcase#history-method",
};

export const fixtureHistoryUnknown: HistoricalSummaryView = {
  observed: unknown("Not enough approved observations"),
  successfulChecks: unknown(),
  periodText: "last 90 days",
  sinceLastText: unknown(),
  medianSeats: unknown("Seat counts not published"),
  coverageNote: "Sample below the minimum gate; nothing is inferred.",
};

/** A structured Ask answer. Every fact in it points at the other fixtures; nothing is composed. */
export const fixtureAskAnswer: AskAnswerView = {
  question:
    "Is it worth driving to Example Terminal C instead of Example Terminal A?",
  verdict: {
    title: "Example Terminal A keeps the fresher evidence",
    kind: "recommendation",
  },
  comparison: {
    options: [
      {
        id: fixtureRoute.id,
        headline: { kind: "best_space_a" },
        title: fixtureRoute.title,
        href: "/showcase#route",
      },
      {
        id: fixtureCandidate.id,
        headline: { kind: "space_a_candidate", position: 2 },
        title: fixtureCandidate.title,
        href: "/showcase#route-2",
      },
    ],
    rows: [
      {
        id: "drive",
        label: "Drive",
        cells: [
          { value: known("35 min"), emphasis: "better" },
          { value: known("1 h 55"), emphasis: "none" },
        ],
      },
      {
        id: "evidence",
        label: "Evidence",
        cells: [
          {
            value: known("Fresh"),
            evidence: { state: "fresh", ageText: "9m" },
            emphasis: "better",
          },
          {
            value: known("Stale"),
            evidence: { state: "source_stale", ageText: "3d" },
            emphasis: "none",
          },
        ],
      },
    ],
  },
  explanation:
    "Synthetic explanation: the closer terminal has a fresh published schedule; the farther one's page has not been read successfully for three days. Neither is a reservation.",
  actions: [
    { label: "Open route", href: "/showcase#route", variant: "primary" },
    { label: "Compare both", href: "/showcase#compare", variant: "secondary" },
  ],
  grounding: [
    { kind: "route_search", count: 1 },
    { kind: "source_record", count: 2 },
  ],
  followUps: [
    "What changed since this morning?",
    "What do I still need before roll call?",
  ],
};

/** The honest shape when a required tool returned unknown: the verdict says so, verbatim. */
export const fixtureAskAnswerUnknown: AskAnswerView = {
  question: "Will there be a seat tomorrow?",
  verdict: {
    title: "Seat release is not published",
    kind: "unknown",
  },
  explanation:
    "Synthetic explanation: no source has published seat counts for that departure, so PaxPivot cannot say. Check the official page or the terminal at roll call.",
  actions: [
    { label: "See the source", href: "/showcase#ledger", variant: "secondary" },
  ],
  grounding: [{ kind: "source_record", count: 1 }],
  followUps: ["What does the terminal page currently show?"],
};
