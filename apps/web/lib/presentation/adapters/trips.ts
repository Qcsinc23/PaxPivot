/**
 * `/api/v1/trips` → Trips screen models (TASK-034). A trip request carries only what the
 * traveler asked for; no route has been searched, so every card says so plainly and lists no
 * source evidence. Nothing here infers eligibility, distance, freshness or order.
 */
import type { TripListRead, TripRead } from "@/lib/api/contracts";
import type { TripsScreenModel } from "@/lib/presentation/screens/trips";
import type { FactView, TripCardView } from "@/lib/presentation/types";
import { known } from "@/lib/presentation/fact";
import { formatTimestamp } from "./format";

export function tripHref(tripId: string): string {
  return `/trips/${tripId}`;
}

function windowText(trip: TripRead): string {
  return `${formatTimestamp(trip.window_start)} – ${formatTimestamp(trip.window_end)}`;
}

function partyText(size: number): string {
  return size === 1 ? "1 traveler" : `${size} travelers`;
}

export function toTripCardView(trip: TripRead): TripCardView {
  return {
    id: trip.trip_id,
    name: `${trip.origin_terminal_name} → ${trip.destination_text}`,
    windowText: windowText(trip),
    partyText: partyText(trip.party_size),
    // No route search exists yet, so there is no source evidence to summarise: an empty
    // list, never a fabricated state.
    sources: [],
    href: tripHref(trip.trip_id),
  };
}

export function toTripsScreenModel(read: TripListRead): TripsScreenModel {
  return {
    status: "ready",
    trips: read.trips.map(toTripCardView),
    journeyStatus: {
      value: "not_started",
      note: "Nothing here is inferred from your location, schedules or aircraft data.",
    },
    newTripHref: "/",
  };
}

export type TripDetailModel = {
  title: string;
  facts: readonly FactView[];
  createdText: string;
};

export function toTripDetailModel(trip: TripRead): TripDetailModel {
  return {
    title: `${trip.origin_terminal_name} → ${trip.destination_text}`,
    facts: [
      { label: "From", value: known(trip.origin_terminal_name) },
      { label: "To", value: known(trip.destination_text) },
      { label: "Window", value: known(windowText(trip)) },
      { label: "Party", value: known(partyText(trip.party_size)) },
    ],
    createdText: `Requested ${formatTimestamp(trip.created_at)}`,
  };
}
