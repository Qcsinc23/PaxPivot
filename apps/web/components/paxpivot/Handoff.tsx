import type { HandoffUnknownKind } from "@/lib/presentation/types";

/** Mandatory on every provider result (pilot GND-003). A handoff is never a booking or a fare. */
export const HANDOFF_UNKNOWN_TEXT: Readonly<
  Record<HandoffUnknownKind, string>
> = {
  availability_and_fare: "availability and fare unknown",
  availability: "availability unknown",
  fare: "fare unknown",
  schedule: "schedule unknown",
  provider_details: "provider details unknown",
};

export function handoffLabelText(
  kind: HandoffUnknownKind = "availability_and_fare",
): string {
  return `Live handoff · ${HANDOFF_UNKNOWN_TEXT[kind]}`;
}

/** The default wording, kept for callers that render a generic provider handoff. */
export const HANDOFF_LABEL = handoffLabelText();

export function HandoffLabel({ kind }: { kind?: HandoffUnknownKind }) {
  return <span className="pp-handoff-label">{handoffLabelText(kind)}</span>;
}
