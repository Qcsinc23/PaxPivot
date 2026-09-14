/**
 * "Commercial flight alternative" (TASK-053): a Google Flights handoff for the trip's own
 * destination, window and party size, plus a curated (non-authoritative) suggested origin. Built
 * only from the already-loaded `TripRead` — no new API call, no schema change. Never a fare, a
 * booking, or a claim about Space-A: see `CommercialHandoff.tsx` for the mandatory handoff label
 * and caveats this view model's facts sit beside.
 */
import type { TripRead } from "@/lib/api/contracts";
import {
  buildGoogleFlightsSearchUrl,
  GOOGLE_FLIGHTS_PLAIN_URL,
} from "@/lib/presentation/commercial-flights-link";
import { known, unknown, type Fact } from "@/lib/presentation/fact";
import { originAirportsForTerminal } from "@/lib/presentation/terminal-origin-airports";
import type { FactView, Href } from "@/lib/presentation/types";
import { formatTimestamp } from "./format";

const NO_CURATED_AIRPORTS_NOTE =
  "No curated airports are listed for this terminal yet.";

function partyText(size: number): string {
  return size === 1 ? "1 traveler" : `${size} travelers`;
}

function windowText(trip: TripRead): string {
  return `${formatTimestamp(trip.window_start)} – ${formatTimestamp(trip.window_end)}`;
}

export type CommercialHandoffViewModel = {
  /** Verification facts shown before either link: destination, window, party, suggested origin. */
  facts: readonly FactView[];
  /** The prefilled Google Flights search built from this trip; carries no origin when uncurated. */
  prefilledHref: Href;
  /** The always-offered, un-prefilled fallback (COM-004). */
  plainHref: Href;
};

export function toCommercialHandoffViewModel(
  trip: TripRead,
): CommercialHandoffViewModel {
  const originAirports = originAirportsForTerminal(trip.origin_terminal_name);
  const originAirportsFact: Fact<string> =
    originAirports.length > 0
      ? known(originAirports.join(", "))
      : unknown(NO_CURATED_AIRPORTS_NOTE);

  return {
    facts: [
      { label: "Destination", value: known(trip.destination_text) },
      { label: "Window", value: known(windowText(trip)) },
      { label: "Party", value: known(partyText(trip.party_size)) },
      { label: "Suggested origin airports", value: originAirportsFact },
    ],
    prefilledHref: buildGoogleFlightsSearchUrl({
      destinationText: trip.destination_text,
      windowStartIso: trip.window_start,
      windowEndIso: trip.window_end,
      partySize: trip.party_size,
      originAirports,
    }),
    plainHref: GOOGLE_FLIGHTS_PLAIN_URL,
  };
}
