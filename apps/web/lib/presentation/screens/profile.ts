/**
 * Profile, readiness and eligibility view models (TASK-014).
 *
 * The profile surface stays in traveler wording; category terminology lives only on the
 * eligibility detail screen, which reports the deterministic decision the application already
 * made. Nothing here evaluates eligibility, and no screen stores anything.
 */
import { known, unknown, type Fact } from "@/lib/presentation/fact";
import {
  fixtureEvidenceRows,
  fixtureReadiness,
} from "@/lib/presentation/fixtures";
import type {
  EligibilitySummaryView,
  EvidenceRowView,
  ReadinessItemView,
} from "@/lib/presentation/types";

export type PartyMemberView = {
  id: string;
  name: string;
  roleText: string;
  href?: string;
};

/** Options for the party-edit form's category attestation and age band selects (TASK-050). */
export const CATEGORY_ATTESTATION_OPTIONS: readonly {
  value: string;
  label: string;
}[] = [
  { value: "I", label: "I" },
  { value: "II", label: "II" },
  { value: "III", label: "III" },
  { value: "IV", label: "IV" },
  { value: "V", label: "V" },
  { value: "VI", label: "VI" },
  { value: "unknown", label: "Unknown" },
];

export const AGE_BAND_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "under_14", label: "Under 14" },
  { value: "minor_14_or_older", label: "14 to 17" },
  { value: "adult", label: "Adult" },
  { value: "unknown", label: "Unknown" },
];

export type PartyFormTravelerView = {
  id: string;
  categoryAttestation: string;
  ageBand: string;
};

/**
 * What `/profile`'s form needs to set the sponsor's category attestation and add or remove
 * dependents with an age band (TASK-050). No eligibility conclusion is computed from it here.
 */
export type PartyFormView = {
  action: string;
  sponsor: PartyFormTravelerView;
  dependents: readonly PartyFormTravelerView[];
  error?: "invalid" | "unavailable";
};

/** "Before you go": progress, the checklist, and the one thing the app cannot settle. */
export type ReadinessView = {
  done: Fact<number>;
  total: Fact<number>;
  dueText?: string;
  items: readonly ReadinessItemView[];
  unresolved?: { title: string; body: string; acknowledgeLabel: string };
  markReadyLabel: string;
};

export type ProfileScreenModel = {
  status: "empty" | "ready" | "loading" | "error";
  eligibility: EligibilitySummaryView;
  party: readonly PartyMemberView[];
  partyForm: PartyFormView;
  readiness: ReadinessView;
  notifications: { rows: readonly EvidenceRowView[]; href: string };
  advancedHref: string;
};

/** Category terminology and the controlling policy live here, and only here. */
export type EligibilityTravelerView = {
  id: string;
  name: string;
  roleText: string;
  categoryText: string;
  ageBandText: string;
  accompaniedText: string;
};

export type EligibilityDetailScreenModel = {
  status: "empty" | "ready" | "loading" | "error";
  decision: EligibilitySummaryView["state"];
  policy: {
    id: string;
    version: string;
    citations: readonly EvidenceRowView[];
  };
  reasons: readonly string[];
  unresolved: readonly string[];
  travelers: readonly EligibilityTravelerView[];
};

/** A blank sponsor-only starting point for the party-edit form (TASK-050). */
export const blankPartyForm: PartyFormView = {
  action: "/profile/edit",
  sponsor: { id: "", categoryAttestation: "unknown", ageBand: "adult" },
  dependents: [],
};

/** The live routes' models until a profile API contract exists. They carry no product data. */
export const emptyProfile: ProfileScreenModel = {
  status: "empty",
  eligibility: { state: "unknown", travelerCount: 0 },
  party: [],
  partyForm: blankPartyForm,
  readiness: {
    done: unknown(),
    total: unknown(),
    items: [],
    markReadyLabel: "Mark ready",
  },
  notifications: { rows: [], href: "/profile" },
  advancedHref: "/advanced",
};

export const emptyEligibilityDetail: EligibilityDetailScreenModel = {
  status: "empty",
  decision: "unknown",
  policy: { id: "", version: "", citations: [] },
  reasons: [],
  unresolved: [],
  travelers: [],
};

/** Synthetic fixtures for tests and the development showcase. Never rendered by a live route. */
export const fixtureProfile: ProfileScreenModel = {
  status: "ready",
  eligibility: {
    state: "eligible",
    travelerCount: 2,
    detailHref: "/showcase/profile/eligibility",
  },
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
  partyForm: {
    action: "/showcase#party-form",
    sponsor: {
      id: "party-sponsor",
      categoryAttestation: "VI",
      ageBand: "adult",
    },
    dependents: [
      {
        id: "party-dependent",
        categoryAttestation: "unknown",
        ageBand: "under_14",
      },
    ],
  },
  readiness: {
    done: known(2),
    total: known(4),
    dueText: "Due day 1",
    items: fixtureReadiness,
    unresolved: {
      title: "We cannot settle the late-arrival plan",
      body: "Ride supply after 23:00 is unknown, so only you can decide whether to accept it.",
      acknowledgeLabel: "Acknowledge",
    },
    markReadyLabel: "Mark ready",
  },
  notifications: {
    rows: fixtureEvidenceRows,
    href: "/showcase#alert-settings",
  },
  advancedHref: "/advanced",
};

export const fixtureEligibilityDetail: EligibilityDetailScreenModel = {
  status: "ready",
  decision: "eligible",
  policy: {
    id: "Example Space-A policy",
    version: "2026.1",
    citations: fixtureEvidenceRows,
  },
  reasons: [
    "Synthetic reason: the sponsor holds current travel orders.",
    "Synthetic reason: dependents travel accompanied by the sponsor.",
  ],
  unresolved: ["Whether a second seat is released on the day of travel."],
  travelers: [
    {
      id: "party-sponsor",
      name: "Sponsor (example)",
      roleText: "Sponsor",
      categoryText: "Category 6 (example)",
      ageBandText: "Adult",
      accompaniedText: "Traveling",
    },
    {
      id: "party-dependent",
      name: "Dependent (example)",
      roleText: "Dependent",
      categoryText: "Category 6 (example)",
      ageBandText: "Child",
      accompaniedText: "Accompanied by sponsor",
    },
  ],
};
