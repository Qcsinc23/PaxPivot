/**
 * Results screen view model (TASK-009).
 *
 * The model carries the ranked list exactly as the application ordered it. The screen renders
 * that order, supplies no comparator, and reorders nothing when the traveler changes the sort —
 * changing the sort asks the application for a different list; it does not sort here.
 */
import {
  fixtureCommercial,
  fixtureMap,
  fixtureRoute,
  fixtureCandidate,
} from "@/lib/presentation/fixtures";
import { fixtureNotices } from "@/lib/presentation/notices";
import type {
  CommercialBaselineView,
  MapView,
  RankingSortMode,
  RouteCardView,
} from "@/lib/presentation/types";
import type {
  ConflictNoticeView,
  HonestAbsenceView,
  KeptResultNoticeView,
  LateCheckNoticeView,
  NotRankedNoticeView,
  RefreshNoticeView,
} from "@/lib/presentation/notices";

/** How one comparator field turned out. `decided` is the field that settled the order. */
export type WhyOrderOutcome = "decided" | "not_needed" | "not_used";

export type WhyOrderStepView = {
  /** 1-based position in the comparator sequence. */
  position: number;
  label: string;
  outcome: WhyOrderOutcome;
  detail: string;
};

/** The first decisive comparator field, in the order the engine applied them. */
export type WhyOrderView = {
  steps: readonly WhyOrderStepView[];
  /** Application wording, e.g. that unknown time or cost is never treated as zero. */
  note: string;
};

export type ResultsScreenModel = {
  status: "ready" | "refreshing" | "no_route" | "loading" | "error";
  /** Origin → destination, as supplied by the application. */
  title: string;
  subtitle: string;
  sort: RankingSortMode;
  map: MapView;
  /** The commercial way out. A different product from a Space-A route; never merged into the list. */
  baseline?: CommercialBaselineView;
  /** Space-A routes in the application's order. The screen preserves it exactly. */
  routes: readonly RouteCardView[];
  notRanked?: NotRankedNoticeView;
  refresh?: RefreshNoticeView;
  kept?: KeptResultNoticeView;
  lateChecks: readonly LateCheckNoticeView[];
  conflicts: readonly ConflictNoticeView[];
  /** Shown instead of the list when nothing usable came back. */
  absence?: HonestAbsenceView;
  whyOrder: WhyOrderView;
  /** Where the side-by-side comparison lives. */
  compareHref: string;
};

const SYNTHETIC_WHY_ORDER: WhyOrderView = {
  steps: [
    {
      position: 1,
      label: "Leaves before the window closes",
      outcome: "decided",
      detail: "One option still departs inside the window; the other does not.",
    },
    {
      position: 2,
      label: "Fewest handoffs",
      outcome: "not_needed",
      detail: "The comparison stopped before reaching this field.",
    },
    {
      position: 3,
      label: "Lowest known cost",
      outcome: "not_used",
      detail: "Cost was unknown for both options, so it decided nothing.",
    },
  ],
  note: "Unknown time or cost never counts as zero, and nothing here is a weighted score.",
};

/** Synthetic fixtures for tests and the development showcase. Never rendered by a live route. */
export const fixtureResults: ResultsScreenModel = {
  status: "ready",
  title: "Example City, DE → Example City, HI",
  subtitle: "Day 1–8 · 2 travelers",
  sort: "recommended",
  map: fixtureMap,
  baseline: fixtureCommercial,
  routes: [fixtureRoute, fixtureCandidate],
  notRanked: fixtureNotices.notRanked,
  lateChecks: [],
  conflicts: [],
  whyOrder: SYNTHETIC_WHY_ORDER,
  compareHref: "/showcase/results#compare",
};

export const fixtureResultsRefreshing: ResultsScreenModel = {
  ...fixtureResults,
  status: "refreshing",
  refresh: fixtureNotices.refresh,
  kept: fixtureNotices.kept,
  lateChecks: [fixtureNotices.late],
  conflicts: [fixtureNotices.conflict],
};

export const fixtureResultsNoRoute: ResultsScreenModel = {
  ...fixtureResults,
  status: "no_route",
  baseline: undefined,
  routes: [],
  notRanked: undefined,
  absence: fixtureNotices.absence,
};
