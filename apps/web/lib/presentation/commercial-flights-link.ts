/**
 * Pure Google Flights link builder for the commercial handoff (TASK-053, COM-002/COM-004).
 *
 * Builds a Google Flights natural-language search URL from data the trip page already has
 * (`TripRead`) plus a curated origin airport list (`terminal-origin-airports.ts`). Never fetches,
 * never calls Google, never stores or logs a destination (PRV-003) — every export here is a pure
 * function evaluated at render time. Encoding goes through `URL`/`URLSearchParams`, which
 * percent-encodes the query text (including unicode) safely; nothing is interpolated into HTML.
 */

export const GOOGLE_FLIGHTS_BASE_URL = "https://www.google.com/travel/flights";

/** The always-available fallback link (COM-004): no query, so no prefill can be "wrong". */
export const GOOGLE_FLIGHTS_PLAIN_URL = GOOGLE_FLIGHTS_BASE_URL;

export type CommercialFlightsLinkInput = {
  /** The trip's destination exactly as the traveler typed it. */
  destinationText: string;
  /** `TripRead.window_start`, an ISO 8601 timestamp. */
  windowStartIso: string;
  /** `TripRead.window_end`, an ISO 8601 timestamp. */
  windowEndIso: string;
  /** `TripRead.party_size`. */
  partySize: number;
  /** Curated commercial airports near the origin terminal; empty when none are curated. */
  originAirports: readonly string[];
};

/**
 * The `YYYY-MM-DD` prefix of an ISO 8601 timestamp, read as plain text rather than through a
 * `Date` object — so the result never shifts under a reader's or a test runner's local timezone.
 */
export function isoDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function partySizeText(partySize: number): string {
  return partySize === 1 ? "1 traveler" : `${partySize} travelers`;
}

/**
 * The natural-language query Google Flights accepts via `?q=`. An empty `originAirports` omits
 * the "from …" clause entirely rather than inventing an origin (see the task's design notes on
 * an uncurated terminal).
 */
export function buildGoogleFlightsQueryText(
  input: CommercialFlightsLinkInput,
): string {
  const start = isoDateOnly(input.windowStartIso);
  const end = isoDateOnly(input.windowEndIso);
  const fromClause =
    input.originAirports.length > 0
      ? ` from ${input.originAirports.join(", ")}`
      : "";
  return `Flights to ${input.destinationText}${fromClause} on ${start} through ${end} for ${partySizeText(input.partySize)}`;
}

/**
 * The full prefilled Google Flights URL. `URL`/`URLSearchParams` percent-encode the query text
 * (special characters and unicode included), so the destination text never needs manual escaping
 * and can never break out of the query string.
 */
export function buildGoogleFlightsSearchUrl(
  input: CommercialFlightsLinkInput,
): string {
  const url = new URL(GOOGLE_FLIGHTS_BASE_URL);
  url.searchParams.set("q", buildGoogleFlightsQueryText(input));
  return url.toString();
}
