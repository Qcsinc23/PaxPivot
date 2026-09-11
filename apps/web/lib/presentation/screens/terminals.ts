/**
 * Terminals view models (TASK-012).
 *
 * The network and the terminal detail render reachable/excluded counts, per-terminal access,
 * entrance status, opportunities, travel options and history exactly as the application
 * established them. Nothing is geocoded, measured or ranked here, and a withdrawn or superseded
 * opportunity keeps the state it was given.
 */
import { known, unknown } from "@/lib/presentation/fact";
import {
  fixtureEvidenceAge,
  fixtureEvidenceRows,
  fixtureHistory,
  fixtureMap,
  fixtureTerminal,
  fixtureTerminalUnverified,
} from "@/lib/presentation/fixtures";
import type {
  EvidenceAgeView,
  EvidenceRowView,
  Fact,
  FactView,
  HandoffUnknownKind,
  HistoricalSummaryView,
  MapView,
  SourceEvidenceView,
  TerminalCardView,
} from "@/lib/presentation/types";

/** How many candidate terminals travel time made reachable, and how many it ruled out. */
export type TerminalNetworkSummaryView = {
  reachable: Fact<number>;
  excluded: Fact<number>;
};

/** The terminal the traveler picked, with what the sheet shows about it. */
export type TerminalNetworkSelectedView = {
  terminal: TerminalCardView;
  facts: readonly FactView[];
  /** The application's own rule wording, e.g. "inside the 90-min drive rule". */
  ruleText: string;
  history: HistoricalSummaryView;
};

export type TerminalNetworkScreenModel = {
  status: "empty" | "ready" | "loading" | "error";
  summary: TerminalNetworkSummaryView;
  map: MapView;
  /** The filter the application has already applied to `terminals`. */
  filter: "reachable" | "excluded";
  terminals: readonly TerminalCardView[];
  selected?: TerminalNetworkSelectedView;
};

/** A published opportunity at a terminal; its state pill is application truth. */
export type TerminalOpportunityView = {
  id: string;
  title: string;
  detail: string;
  evidence: SourceEvidenceView;
};

export type TerminalDetailScreenModel = {
  status: "empty" | "ready" | "loading" | "error";
  terminal: TerminalCardView;
  map: MapView;
  stats: readonly FactView[];
  actions: {
    directionsHref: string;
    watchHref: string;
    officialHref: string;
  };
  opportunities: readonly TerminalOpportunityView[];
  travel: {
    rows: readonly EvidenceRowView[];
    handoffs: readonly {
      id: string;
      title: string;
      detail: string;
      href: string;
      /** What this provider leaves unconfirmed; omitted means availability and fare. */
      unknown?: HandoffUnknownKind;
    }[];
  };
  evidence: {
    age: EvidenceAgeView;
    rows: readonly EvidenceRowView[];
    /** Why this terminal is in the list at all; shown behind a disclosure. */
    whyIncluded: string;
  };
  history: HistoricalSummaryView;
  compareHref: string;
};

const UNKNOWN_AGE: EvidenceAgeView = {
  sourceTime: unknown(),
  observedAt: { iso: "", text: "" },
  ageText: unknown(),
};

const NO_HISTORY: HistoricalSummaryView = {
  observed: unknown(),
  successfulChecks: unknown(),
  periodText: "no period yet",
  sinceLastText: unknown(),
  medianSeats: unknown(),
  coverageNote: "",
};

const NO_TERMINAL: TerminalCardView = {
  id: "none",
  name: "",
  accessText: unknown(),
  evidence: { state: "source_missing" },
  entrance: { status: "unverified", label: unknown() },
  href: "/terminals",
};

/** Live models until a terminal API contract exists. They carry no product data. */
export const emptyTerminalNetwork: TerminalNetworkScreenModel = {
  status: "empty",
  summary: { reachable: unknown(), excluded: unknown() },
  map: { title: "Terminal network", status: "empty", markers: [] },
  filter: "reachable",
  terminals: [],
};

export const emptyTerminalDetail: TerminalDetailScreenModel = {
  status: "empty",
  terminal: NO_TERMINAL,
  map: { title: "Terminal map", status: "empty", markers: [] },
  stats: [],
  actions: {
    directionsHref: "/terminals",
    watchHref: "/terminals",
    officialHref: "/terminals",
  },
  opportunities: [],
  travel: { rows: [], handoffs: [] },
  evidence: { age: UNKNOWN_AGE, rows: [], whyIncluded: "" },
  history: NO_HISTORY,
  compareHref: "/terminals",
};

/** Synthetic fixtures for tests and the development showcase. Never rendered by a live route. */
export const fixtureTerminalNetwork: TerminalNetworkScreenModel = {
  status: "ready",
  summary: { reachable: known(12), excluded: known(3) },
  map: fixtureMap,
  filter: "reachable",
  terminals: [fixtureTerminal, fixtureTerminalUnverified],
  selected: {
    terminal: fixtureTerminal,
    facts: [
      { label: "From you", value: known("35 min drive") },
      { label: "Hours", value: known("24 h") },
      { label: "Parking", value: unknown("Not published") },
    ],
    ruleText: "Inside the 90-min drive rule for this trip.",
    history: fixtureHistory,
  },
};

export const fixtureTerminalDetail: TerminalDetailScreenModel = {
  status: "ready",
  terminal: fixtureTerminal,
  map: fixtureMap,
  stats: [
    { label: "Entrance", value: known("Verified entrance on record") },
    { label: "Hours", value: known("24 h") },
    { label: "Published opportunities", value: known("2") },
    { label: "Parking", value: unknown("Not published") },
  ],
  actions: {
    directionsHref: "https://example.invalid/directions",
    watchHref: "/showcase#watch",
    officialHref: "https://example.invalid/terminal-a",
  },
  opportunities: [
    {
      id: "opportunity-1",
      title: "Example Terminal A → Example Terminal B",
      detail: "Departs 06:00, as published",
      evidence: { state: "fresh", ageText: "9m" },
    },
    {
      id: "opportunity-2",
      title: "Example Terminal A → Example Terminal C",
      detail: "Superseded by a later schedule revision",
      evidence: { state: "superseded" },
    },
    {
      id: "opportunity-3",
      title: "Example Terminal A → Example Terminal D",
      detail: "Withdrawn by the source",
      evidence: { state: "withdrawn" },
    },
  ],
  travel: {
    rows: fixtureEvidenceRows,
    handoffs: [
      {
        id: "handoff-1",
        title: "Rideshare to the gate",
        detail: "Provider handoff",
        href: "https://example.invalid/ride",
        unknown: "availability",
      },
      {
        id: "handoff-2",
        title: "Public transit",
        detail: "Timetable only",
        href: "https://example.invalid/transit",
        unknown: "schedule",
      },
    ],
  },
  evidence: {
    age: fixtureEvidenceAge,
    rows: fixtureEvidenceRows,
    whyIncluded:
      "Synthetic rule wording. In production this is the deterministic reason the terminal was included or excluded.",
  },
  history: fixtureHistory,
  compareHref: "/showcase/terminals#compare",
};
