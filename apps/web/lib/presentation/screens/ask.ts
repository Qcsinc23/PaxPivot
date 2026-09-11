/**
 * Ask PaxPivot screen model (TASK-015).
 *
 * Presentation only. The answer arrives whole from the application (`AskAnswerView`, TASK-019):
 * its verdict, the comparison it built, its explanation, its actions and its grounding are all
 * decided before they reach here. Nothing in this screen composes an answer, calls a provider,
 * runs a tool or invents a citation.
 */
import {
  fixtureAskAnswer,
  fixtureAskAnswerUnknown,
} from "@/lib/presentation/fixtures";
import type { AskAnswerView } from "@/lib/presentation/types";

export type AskScreenModel = {
  status: "empty" | "ready" | "loading" | "error";
  /** Absent until the application can produce an answer; the live route never fakes one. */
  answer?: AskAnswerView;
  /** Shown in the disabled composer, so the traveler knows why they cannot type yet. */
  composerPlaceholder: string;
};

/** The live route's model until the Ask tool contract exists. It carries no answer. */
export const emptyAsk: AskScreenModel = {
  status: "empty",
  composerPlaceholder:
    "Asking questions is not connected yet. It arrives with the Ask PaxPivot tool contract.",
};

/** Synthetic fixture for tests and the development showcase. Never rendered by a live route. */
export const fixtureAsk: AskScreenModel = {
  status: "ready",
  answer: fixtureAskAnswer,
  composerPlaceholder:
    "Asking questions is not connected yet. It arrives with the Ask PaxPivot tool contract.",
};

/** The honest shape when a required tool returned unknown. */
export const fixtureAskUnknown: AskScreenModel = {
  status: "ready",
  answer: fixtureAskAnswerUnknown,
  composerPlaceholder:
    "Asking questions is not connected yet. It arrives with the Ask PaxPivot tool contract.",
};
