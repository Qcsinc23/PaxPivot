/**
 * TASK-034: trip requests end to end on the web side. The adapter presents only what the
 * traveler asked for, the form posts to a server route, and the route hands the API the
 * decision; nothing renders as a route or a source state.
 */
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { NewTripForm } from "@/components/screens/plan/NewTripForm";
import { TripsScreen } from "@/components/screens/trips/TripsScreen";
import type { TripRead } from "@/lib/api/contracts";
import {
  toTripDetailModel,
  toTripsScreenModel,
} from "@/lib/presentation/adapters/trips";

const TRIP: TripRead = {
  trip_id: "6f1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7",
  origin_terminal_id: "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a",
  origin_terminal_name: "Example Passenger Terminal",
  destination_text: "Somewhere warm",
  window_start: "2026-10-01T06:00:00Z",
  window_end: "2026-10-04T06:00:00Z",
  party_size: 2,
  created_at: "2026-09-11T12:00:00Z",
};

describe("trip adapters", () => {
  test("a request card carries no source evidence and links to the trip", () => {
    const model = toTripsScreenModel({ trips: [TRIP] });
    expect(model.trips).toHaveLength(1);
    expect(model.trips[0]).toMatchObject({
      id: TRIP.trip_id,
      partyText: "2 travelers",
      sources: [],
      href: `/trips/${TRIP.trip_id}`,
    });
    expect(model.trips[0]?.top).toBeUndefined();
    render(<TripsScreen model={model} />);
    expect(
      screen.getByRole("heading", {
        name: "Example Passenger Terminal → Somewhere warm",
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/flight|eligib|probab/i)).toBeNull();
  });

  test("the detail model states only the request", () => {
    const detail = toTripDetailModel(TRIP);
    expect(detail.facts.map((f) => f.label)).toEqual([
      "From",
      "To",
      "Window",
      "Party",
    ]);
  });
});

describe("new trip form and route", () => {
  test("the form posts to the server route with native constraints", () => {
    render(
      <NewTripForm
        terminals={[{ id: TRIP.origin_terminal_id, name: "Example" }]}
        error="invalid"
      />,
    );
    const party = screen.getByLabelText("Travelers") as HTMLInputElement;
    expect(party.min).toBe("1");
    expect(party.max).toBe("9");
    expect(screen.getByRole("alert").textContent).toMatch(/not accepted/);
    expect(document.querySelector("form")?.getAttribute("action")).toBe(
      "/trips/new",
    );
  });
});
