/**
 * Traveler-facing wording for an eligibility state the application has already decided.
 * Surfaces say "Eligible · 2 travelers"; category codes stay under Profile/eligibility detail.
 * Nothing here evaluates eligibility — the state and the count arrive from the application.
 */
import type { StatusTone } from "./source-state";
import type { EligibilitySummaryView } from "./types";

export type EligibilityWording = {
  text: string;
  tone: StatusTone;
  srText: string;
};

export const ELIGIBILITY_WORDING: Readonly<
  Record<EligibilitySummaryView["state"], EligibilityWording>
> = {
  eligible: {
    text: "Eligible",
    tone: "verified",
    srText:
      "your party can request Space-A travel; a seat is still not guaranteed",
  },
  ineligible: {
    text: "Not eligible",
    tone: "caution",
    srText: "this request does not qualify under the current policy",
  },
  unknown: {
    text: "Eligibility unknown",
    tone: "unknown",
    srText: "not enough information to decide yet",
  },
  outside_supported_scope: {
    text: "Outside supported scope",
    tone: "unknown",
    srText: "this case is not covered yet",
  },
};

/** "Eligible · 2 travelers" — formatting only. */
export function eligibilitySummaryText(
  eligibility: EligibilitySummaryView,
): string {
  const noun = eligibility.travelerCount === 1 ? "traveler" : "travelers";
  return `${ELIGIBILITY_WORDING[eligibility.state].text} · ${eligibility.travelerCount} ${noun}`;
}
