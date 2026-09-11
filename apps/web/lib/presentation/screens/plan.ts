/**
 * Plan screen view model (TASK-007).
 *
 * The screen model composes foundation presentation types only. Every decision — eligibility
 * state, access limits, positioning choices, sort order — arrives here from the application.
 * The screen names these values and never computes eligibility, distance, limits or ordering.
 * Unknown stays `Fact`-unknown: it is never rendered as 0, "None" or a blank.
 */
import { known, unknown, type Fact } from "@/lib/presentation/fact";
import {
  fixtureTerminal,
  fixtureTerminalUnverified,
  fixtureTrip,
} from "@/lib/presentation/fixtures";
import type {
  EligibilitySummaryView,
  RankingSortMode,
  SourceEvidenceView,
  TripCardView,
} from "@/lib/presentation/types";

/**
 * One positioning limit. `value` is the display text; `progress` is the 0–100 bar position.
 * Both are application-supplied. `progress` is absent when no limit is set, so the screen
 * never draws a bar that would imply a number the application did not establish.
 */
export type AccessLimitView = {
  value: Fact<string>;
  progress?: number;
};

export type TripSettingsToggleView = {
  id: string;
  title: string;
  detail: string;
  enabled: boolean;
};

export type TripSettingsPartyView = {
  id: string;
  name: string;
  roleText: string;
  href: string;
};

/** Preferences one tap down from Plan. Nothing here is persisted by this task. */
export type TripSettingsModel = {
  driveLimit: AccessLimitView;
  transitLimit: AccessLimitView;
  toggles: readonly TripSettingsToggleView[];
  party: readonly TripSettingsPartyView[];
  /** Where the sponsor-rule explanation lives; the wording itself is not duplicated here. */
  whyHref: string;
};

/** A terminal near the origin, as shown in the Plan list (never on the map in this task). */
export type NearbyTerminalView = {
  id: string;
  name: string;
  accessText: Fact<string>;
  /** Omitted when no source for this terminal has been observed yet. */
  evidence?: SourceEvidenceView;
  href: string;
};

export type PlanScreenModel = {
  status: "empty" | "ready" | "loading" | "error";
  origin: Fact<string>;
  eligibility?: EligibilitySummaryView;
  /** The destination currently asked for; absent until the traveler sets one. */
  destinationQuery?: string;
  window?: Fact<string>;
  partyText?: string;
  sort: RankingSortMode;
  watching: readonly TripCardView[];
  nearbyTerminals: readonly NearbyTerminalView[];
  /** State of the sources behind this screen, as last established by the application. */
  sourcesUpdated?: SourceEvidenceView;
  settings: TripSettingsModel;
};

/**
 * The live route's model until a trip-request API contract exists. It carries no product
 * data: no trips, terminals or source states are invented to make the surface look complete.
 */
export const emptyPlan: PlanScreenModel = {
  status: "empty",
  origin: unknown("No origin set yet"),
  sort: "recommended",
  watching: [],
  nearbyTerminals: [],
  settings: {
    driveLimit: { value: unknown() },
    transitLimit: { value: unknown() },
    toggles: [],
    party: [],
    whyHref: "/profile",
  },
};

/** Synthetic fixture for tests and the development showcase. Never rendered by a live route. */
export const fixturePlan: PlanScreenModel = {
  status: "ready",
  origin: known("Example City, DE"),
  eligibility: {
    state: "eligible",
    travelerCount: 2,
    detailHref: "/showcase#eligibility",
  },
  destinationQuery: "Example City, HI",
  window: known("Day 1–8"),
  partyText: "2 travelers",
  sort: "recommended",
  watching: [fixtureTrip],
  nearbyTerminals: [
    {
      id: fixtureTerminal.id,
      name: fixtureTerminal.name,
      accessText: fixtureTerminal.accessText,
      evidence: fixtureTerminal.evidence,
      href: "/showcase#terminal",
    },
    {
      id: fixtureTerminalUnverified.id,
      name: fixtureTerminalUnverified.name,
      accessText: fixtureTerminalUnverified.accessText,
      evidence: fixtureTerminalUnverified.evidence,
      href: "/showcase#terminal-d",
    },
  ],
  sourcesUpdated: {
    state: "fresh",
    ageText: "9m",
    explanation:
      "Synthetic fixture explanation. In production this text is the deterministic source-state explanation supplied by the application.",
  },
  settings: {
    driveLimit: { value: known("90 min"), progress: 72 },
    transitLimit: { value: known("2 h"), progress: 48 },
    toggles: [
      {
        id: "verified-entrance",
        title: "Verified entrance only",
        detail: "Hide terminals without a confirmed passenger entrance",
        enabled: true,
      },
      {
        id: "late-arrival",
        title: "Include late-arrival plans",
        detail: "Show options that finish after 23:00",
        enabled: false,
      },
    ],
    party: [
      {
        id: "party-sponsor",
        name: "Sponsor (example)",
        roleText: "Sponsor · traveling",
        href: "/showcase#party",
      },
      {
        id: "party-dependent",
        name: "Dependent (example)",
        roleText: "Dependent · accompanied",
        href: "/showcase#party",
      },
    ],
    whyHref: "/showcase#eligibility",
  },
};
