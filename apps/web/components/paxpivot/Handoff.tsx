/** Mandatory on every provider result (pilot GND-003). A handoff is never a booking or a fare. */
export const HANDOFF_LABEL = "Live handoff · availability and fare unknown";

export function HandoffLabel() {
  return <span className="pp-handoff-label">{HANDOFF_LABEL}</span>;
}
