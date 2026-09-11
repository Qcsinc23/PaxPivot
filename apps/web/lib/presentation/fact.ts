/**
 * A value the application either established or explicitly did not.
 *
 * Unknown is a valid value (PRD §2). Components render `Fact`s; they never coerce an
 * unknown into 0, "", "none" or "no flights". The optional note is application-supplied
 * display text explaining why the value is unknown (e.g. "Provider quote failed").
 */
export type Fact<T> =
  | { status: "known"; value: T }
  | { status: "unknown"; note?: string };

export const known = <T>(value: T): Fact<T> => ({ status: "known", value });

export const unknown = (note?: string): Fact<never> =>
  note === undefined ? { status: "unknown" } : { status: "unknown", note };

export const UNKNOWN_TEXT = "Unknown";

/** Display text for a fact. Unknown facts always read "Unknown", never a placeholder number. */
export function factText<T>(
  fact: Fact<T>,
  format: (value: T) => string = String,
): string {
  return fact.status === "known" ? format(fact.value) : UNKNOWN_TEXT;
}
