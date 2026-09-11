/**
 * Route comparison view model (TASK-010).
 *
 * The comparison is a table of fields the application already judged. `emphasis` arrives from
 * the application — the screen only styles it. Nothing here decides which option is better, and
 * an unknown value is never promoted or demoted by the screen.
 */
import { known, unknown } from "@/lib/presentation/fact";
import { fixtureCandidate, fixtureRoute } from "@/lib/presentation/fixtures";
import type {
  Fact,
  RouteHeadline,
  SourceEvidenceView,
} from "@/lib/presentation/types";

/** How a cell compares to the other options. Application truth, never computed in the screen. */
export type CompareEmphasis = "better" | "tie" | "none";

export type CompareCellView = {
  value: Fact<string>;
  evidence?: SourceEvidenceView;
  emphasis: CompareEmphasis;
};

export type CompareRowView = {
  id: string;
  label: string;
  cells: readonly CompareCellView[];
};

export type CompareOptionView = {
  id: string;
  /** A Space-A headline, or the commercial baseline's own label. */
  headline: RouteHeadline | "safest_overall";
  title: string;
  href: string;
};

export type CompareScreenModel = {
  status: "empty" | "ready" | "loading" | "error";
  /** Table caption: what is being compared. */
  title: string;
  options: readonly CompareOptionView[];
  rows: readonly CompareRowView[];
  /** One line of trade-off wording, supplied by the application. */
  trade?: string;
  /** The field or reason that settled the order. */
  decidedBy?: string;
  actions: { watchAllHref?: string; openHref: string };
};

/** The live route's model until a comparison API contract exists. Carries no product data. */
export const emptyCompare: CompareScreenModel = {
  status: "empty",
  title: "Route comparison",
  options: [],
  rows: [],
  actions: { openHref: "/trips" },
};

/** Synthetic fixture for tests and the development showcase. Never rendered by a live route. */
export const fixtureCompare: CompareScreenModel = {
  status: "ready",
  title: "Example Terminal A vs Example Terminal C → Example Terminal B",
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
      id: "known-cost",
      label: "Known cost",
      cells: [
        { value: known("$10"), emphasis: "better" },
        { value: unknown("Cost not published"), emphasis: "none" },
      ],
    },
    {
      id: "drive",
      label: "Drive",
      cells: [
        { value: known("35 min"), emphasis: "better" },
        { value: known("1 h 55"), emphasis: "none" },
      ],
    },
    {
      id: "handoffs",
      label: "Handoffs",
      cells: [
        {
          value: known("2"),
          evidence: { state: "fresh", ageText: "9m" },
          emphasis: "tie",
        },
        {
          value: known("1"),
          evidence: { state: "source_stale", ageText: "3d" },
          emphasis: "tie",
        },
      ],
    },
    {
      id: "arrival",
      label: "Arrival",
      cells: [
        { value: unknown(), emphasis: "none" },
        { value: unknown("No published arrival"), emphasis: "none" },
      ],
    },
  ],
  trade:
    "The second option is slower but has one fewer handoff and no published cost.",
  decidedBy: "Freshest evidence, then the fewest handoffs.",
  actions: { watchAllHref: "/showcase#watch", openHref: "/showcase#route" },
};
