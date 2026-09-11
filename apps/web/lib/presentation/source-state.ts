/**
 * Compact traveler-facing lexicon for the thirteen authoritative source states.
 *
 * The codes mirror `apps/api/paxpivot/domain/source.py::SourceState` exactly and are the
 * only values the UI accepts. The UI never derives a state (no freshness maths here); it
 * maps an application-supplied code to a label, a status tone and screen-reader wording.
 * Long deterministic explanations come from the application (TASK-002) and are shown on
 * demand, never composed in the browser.
 */
export const SOURCE_STATE_CODES = [
  "fresh",
  "source_stale",
  "source_unreachable",
  "source_changed_unparsed",
  "source_missing",
  "source_conflict",
  "monitor_delayed",
  "no_departures_published",
  "no_compatible_opportunity",
  "restricted_user_open_only",
  "parser_review_required",
  "superseded",
  "withdrawn",
] as const;

export type SourceStateCode = (typeof SOURCE_STATE_CODES)[number];

/** verified → slate, caution → terracotta, unknown → warm neutral. Never green. */
export type StatusTone = "verified" | "caution" | "unknown";

export type SourceStateLexeme = {
  label: string;
  tone: StatusTone;
  /** Appended for assistive technology so uncertainty is never colour-only. */
  srText: string;
};

export const SOURCE_STATE_LEXICON: Readonly<
  Record<SourceStateCode, SourceStateLexeme>
> = {
  fresh: {
    label: "Fresh",
    tone: "verified",
    srText: "read successfully; not a reservation or a seat",
  },
  source_stale: {
    label: "Stale",
    tone: "caution",
    srText: "no recent successful read; nothing here is current",
  },
  source_unreachable: {
    label: "Unavailable",
    tone: "unknown",
    srText: "source could not be reached; not evidence of no departures",
  },
  source_changed_unparsed: {
    label: "Unreadable",
    tone: "unknown",
    srText: "source changed and could not be interpreted",
  },
  source_missing: {
    label: "Missing",
    tone: "unknown",
    srText: "source page or file could not be found",
  },
  source_conflict: {
    label: "Conflict",
    tone: "caution",
    srText: "official sources disagree; held for review",
  },
  monitor_delayed: {
    label: "Late check",
    tone: "caution",
    srText: "scheduled check ran late; last result stays stale",
  },
  no_departures_published: {
    label: "None published",
    tone: "verified",
    srText: "this source explicitly published no departures",
  },
  no_compatible_opportunity: {
    label: "No match",
    tone: "verified",
    srText: "read successfully; nothing matched this request",
  },
  restricted_user_open_only: {
    label: "Open yourself",
    tone: "unknown",
    srText: "restricted source; only you may open it",
  },
  parser_review_required: {
    label: "Needs review",
    tone: "caution",
    srText: "awaiting human review; not current evidence",
  },
  superseded: {
    label: "Superseded",
    tone: "unknown",
    srText: "replaced by a later observation",
  },
  withdrawn: {
    label: "Withdrawn",
    tone: "unknown",
    srText: "withdrawn by the source; no longer current",
  },
};

export function isSourceStateCode(value: unknown): value is SourceStateCode {
  return (
    typeof value === "string" &&
    (SOURCE_STATE_CODES as readonly string[]).includes(value)
  );
}
