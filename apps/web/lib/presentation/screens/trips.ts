/**
 * Trips shelf view model (TASK-013).
 *
 * The watched trips arrive in the application's order with their own source summaries. Journey
 * status is user-confirmed: the screen reports the value it was given and never infers progress
 * from location, schedules or aircraft data.
 */
import { fixtureTrip } from "@/lib/presentation/fixtures";
import type { TripCardView } from "@/lib/presentation/types";

export type JourneyStatusValue =
  | "not_started"
  | "travelling"
  | "arrived"
  | "did_not_board";

export type TripsScreenModel = {
  status: "empty" | "ready" | "loading" | "error";
  trips: readonly TripCardView[];
  journeyStatus: {
    value: JourneyStatusValue;
    /** Application wording, e.g. that nothing here is inferred from position data. */
    note: string;
  };
  newTripHref: string;
};

/** A trip with no route yet: only what was checked is known about it. */
const tripWithoutRoute: TripCardView = {
  id: "trip-fixture-2",
  name: "Example Base",
  windowText: "Day 3–6",
  partyText: "2 travelers",
  sources: [
    { evidence: { state: "no_compatible_opportunity" }, count: 2 },
    { evidence: { state: "source_unreachable" }, count: 1 },
  ],
  href: "/showcase#trip-2",
};

/** The live route's model until a trips API contract exists. Carries no product data. */
export const emptyTrips: TripsScreenModel = {
  status: "empty",
  trips: [],
  journeyStatus: {
    value: "not_started",
    note: "Nothing here is inferred from your location, schedules or aircraft data.",
  },
  newTripHref: "/",
};

/** Synthetic fixture for tests and the development showcase. Never rendered by a live route. */
export const fixtureTrips: TripsScreenModel = {
  status: "ready",
  trips: [fixtureTrip, tripWithoutRoute],
  journeyStatus: {
    value: "not_started",
    note: "Nothing here is inferred from your location, schedules or aircraft data. You tell us where you are.",
  },
  newTripHref: "/showcase#new-trip",
};
