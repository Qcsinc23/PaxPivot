/**
 * Route detail view model (TASK-011).
 *
 * Everything the four tabs show — the four stats, the ranking reason, the unresolved condition,
 * the journey legs in travel order, the evidence rows, the fallback options and the history —
 * arrives from the application. The screen renders it and evaluates nothing.
 */
import { known, unknown } from "@/lib/presentation/fact";
import {
  fixtureCommercial,
  fixtureEvidenceAge,
  fixtureEvidenceRows,
  fixtureHistory,
  fixtureLegs,
  fixtureMap,
  fixtureRoute,
} from "@/lib/presentation/fixtures";
import type {
  CommercialBaselineView,
  EvidenceAgeView,
  EvidenceRowView,
  FactView,
  HistoricalSummaryView,
  JourneyLegView,
  MapView,
  RouteHeadline,
  SourceEvidenceView,
} from "@/lib/presentation/types";

/** What one source showed, and where to see it yourself. */
export type RouteDetailEvidenceView = {
  sourceName: string;
  evidence: SourceEvidenceView;
  /** The page's own time and our read time, kept separate. */
  age: EvidenceAgeView;
  rows: readonly EvidenceRowView[];
  openHref: string;
  reportHref: string;
};

export type RouteDetailFallbackView = {
  primary?: CommercialBaselineView;
  /** Other ways out. Plain handoffs, never PaxPivot fares. */
  others: readonly {
    id: string;
    title: string;
    detail: string;
    href: string;
  }[];
};

export type RouteDetailScreenModel = {
  status: "empty" | "ready" | "loading" | "error";
  title: string;
  subtitle: string;
  headline: RouteHeadline;
  map: MapView;
  stats: readonly FactView[];
  rankingReason: string;
  /** The condition this route cannot resolve. Shown as an "Unknown:" line, never hidden. */
  unresolved?: string;
  legs: readonly JourneyLegView[];
  evidence: RouteDetailEvidenceView;
  fallback: RouteDetailFallbackView;
  history: HistoricalSummaryView;
  actions: { prepareHref: string; watchHref?: string; shareHref?: string };
};

/** The live route's model until a route API contract exists. Carries no product data. */
export const emptyRouteDetail: RouteDetailScreenModel = {
  status: "empty",
  title: "Route detail",
  subtitle: "",
  headline: { kind: "best_space_a" },
  map: { title: "Route map", status: "empty", markers: [] },
  stats: [],
  rankingReason: "",
  legs: [],
  evidence: {
    sourceName: "",
    evidence: { state: "source_missing" },
    age: {
      sourceTime: unknown(),
      observedAt: { iso: "", text: "" },
      ageText: unknown(),
    },
    rows: [],
    openHref: "/trips",
    reportHref: "/trips",
  },
  fallback: { others: [] },
  history: {
    observed: unknown(),
    successfulChecks: unknown(),
    periodText: "no period yet",
    sinceLastText: unknown(),
    medianSeats: unknown(),
    coverageNote: "",
  },
  actions: { prepareHref: "/trips" },
};

/** Synthetic fixture for tests and the development showcase. Never rendered by a live route. */
export const fixtureRouteDetail: RouteDetailScreenModel = {
  status: "ready",
  title: fixtureRoute.title,
  subtitle: "Day 2 · 2 travelers",
  headline: fixtureRoute.headline,
  map: fixtureMap,
  stats: [
    { label: "Known cost", value: fixtureRoute.knownCost },
    { label: "Handoffs", value: known("2") },
    { label: "Space-A leg", value: known("1") },
    { label: "Arrival", value: unknown("No published arrival") },
  ],
  rankingReason: fixtureRoute.rankingReason,
  unresolved: fixtureRoute.unresolved,
  legs: fixtureLegs,
  evidence: {
    sourceName: "Official terminal page (example)",
    evidence: fixtureRoute.evidence,
    age: fixtureEvidenceAge,
    rows: fixtureEvidenceRows,
    openHref: "https://example.invalid/terminal-page",
    reportHref: "/showcase#report",
  },
  fallback: {
    primary: { ...fixtureCommercial, headline: "fallback" },
    others: [
      {
        id: "fallback-other-1",
        title: "Example Airport → Example City",
        detail: "Commercial search, provider handoff",
        href: "/showcase#commercial",
      },
      {
        id: "fallback-other-2",
        title: "Example Terminal D",
        detail: "No departures published",
        href: "/showcase#terminal-d",
      },
    ],
  },
  history: fixtureHistory,
  actions: {
    prepareHref: "/showcase#prepare",
    watchHref: "/showcase#watch",
    shareHref: "/showcase#share",
  },
};
