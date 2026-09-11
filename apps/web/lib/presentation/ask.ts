/**
 * Presentation helpers for `AskAnswerView` (PRD §11.3). Wording only: the verdict kind, the
 * grounding counts and the comparison arrive decided from the application. No answer is
 * composed here, and an `unknown` verdict is always rendered as the word "Unknown".
 */
import type {
  AskGroundingKind,
  AskGroundingView,
  AskVerdictKind,
} from "./types";

export type AskVerdictWording = {
  label: string;
  tone: "best" | "unknown" | "caution";
};

/** The pill next to a verdict title. `unknown` must read "Unknown" verbatim. */
export const ASK_VERDICT_WORDING: Readonly<
  Record<AskVerdictKind, AskVerdictWording>
> = {
  recommendation: { label: "Recommendation", tone: "best" },
  unknown: { label: "Unknown", tone: "unknown" },
  clarification: { label: "Needs clarification", tone: "caution" },
};

/** Nouns for each provenance category; counts are the application's. */
export const ASK_GROUNDING_NOUNS: Readonly<
  Record<AskGroundingKind, { singular: string; plural: string }>
> = {
  route_search: { singular: "route search", plural: "route searches" },
  source_record: { singular: "source record", plural: "source records" },
  policy: { singular: "policy citation", plural: "policy citations" },
  history: { singular: "historical check", plural: "historical checks" },
};

export function askGroundingItemText(item: AskGroundingView): string {
  const noun = ASK_GROUNDING_NOUNS[item.kind];
  return `${item.count} ${item.count === 1 ? noun.singular : noun.plural}`;
}

/** "Based on 3 route searches · 2 source records", or an explicit statement of no grounding. */
export function askGroundingText(
  grounding: readonly AskGroundingView[],
): string {
  if (grounding.length === 0) return "Based on no structured records";
  return `Based on ${grounding.map(askGroundingItemText).join(" · ")}`;
}
