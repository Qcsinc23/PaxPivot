import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { readApi } from "@/lib/api/client";
import TripsLivePage from "@/app/trips/page";
import { TripsScreen } from "@/components/screens/trips/TripsScreen";
import { emptyTrips, fixtureTrips } from "@/lib/presentation/screens/trips";
import { expectNoAxeViolations } from "../a11y";

vi.mock("@/lib/api/client", () => ({ readApi: vi.fn() }));

describe("TripsScreen", () => {
  test("lists the watched trips in the supplied order", () => {
    render(<TripsScreen model={fixtureTrips} />);

    const shelf = screen.getByRole("region", { name: "Watched trips" });
    const titles = within(shelf)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual(fixtureTrips.trips.map((trip) => trip.name));
  });

  test("offers a labelled New trip control", () => {
    render(<TripsScreen model={fixtureTrips} />);
    expect(
      screen.getByRole("link", { name: "New trip" }).getAttribute("href"),
    ).toBe(fixtureTrips.newTripHref);
  });

  test("journey status is a four-way choice that starts on the model's value", () => {
    render(<TripsScreen model={fixtureTrips} />);

    expect(
      screen.getByRole("heading", { name: "Where are you now?" }),
    ).toBeTruthy();
    const group = screen.getByRole("group", { name: "Your journey status" });
    for (const label of [
      "Not started",
      "Travelling",
      "Arrived",
      "Didn't get on",
    ]) {
      expect(within(group).getByRole("radio", { name: label })).toBeTruthy();
    }
    expect(
      (
        within(group).getByRole("radio", {
          name: "Not started",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  test("takes the journey status the model supplies, not a default", () => {
    render(
      <TripsScreen
        model={{
          ...fixtureTrips,
          journeyStatus: { ...fixtureTrips.journeyStatus, value: "arrived" },
        }}
      />,
    );
    const group = screen.getByRole("group", { name: "Your journey status" });
    expect(
      (
        within(group).getByRole("radio", {
          name: "Arrived",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  test("says the status is user-confirmed, never inferred", () => {
    render(<TripsScreen model={fixtureTrips} />);
    expect(
      screen.getByText(/Nothing here is inferred from your location/),
    ).toBeTruthy();
    // The note is the model's wording, not one baked into the screen.
    const note = "Fixture note: only you set this.";
    const { unmount } = render(
      <TripsScreen
        model={{
          ...fixtureTrips,
          journeyStatus: { ...fixtureTrips.journeyStatus, note },
        }}
      />,
    );
    expect(screen.getByText(note)).toBeTruthy();
    unmount();
  });

  test("a trip without a route shows its sources and a way to see what was checked", () => {
    const { container } = render(<TripsScreen model={fixtureTrips} />);

    const withoutRoute = fixtureTrips.trips.find((trip) => !trip.top);
    expect(withoutRoute).toBeTruthy();

    const shelf = screen.getByRole("region", { name: "Watched trips" });
    const items = within(shelf).getAllByRole("listitem");
    expect(items).toHaveLength(fixtureTrips.trips.length);

    // The route-less trip keeps its source summary pills...
    const routeLess = items.find((item) =>
      item.textContent?.includes(withoutRoute?.name as string),
    );
    expect(routeLess).toBeTruthy();
    const pills = Array.from(
      (routeLess as HTMLElement).querySelectorAll(".pp-pill"),
    ).map((pill) => (pill.textContent ?? "").toLowerCase());
    // TripCard renders "<count> <state>" for each source it checked.
    expect(pills.some((text) => text.includes("no match"))).toBe(true);
    expect(pills.some((text) => text.includes("unavailable"))).toBe(true);

    // ...and offers the checked-sources affordance rather than an empty card.
    expect(
      within(routeLess as HTMLElement).getByRole("link", {
        name: "See what was checked",
      }),
    ).toBeTruthy();

    // A trip that does have a route does not show that affordance.
    const withRoute = items.find((item) =>
      item.textContent?.includes(
        (fixtureTrips.trips.find((trip) => trip.top)?.name ?? "") as string,
      ),
    );
    expect(
      within(withRoute as HTMLElement).queryByRole("link", {
        name: "See what was checked",
      }),
    ).toBeNull();
    expect(container).toBeTruthy();
  });
});

describe("TripsScreen states", () => {
  test("empty says nothing is planned and offers one action", () => {
    const { container } = render(<TripsScreen model={emptyTrips} />);

    expect(screen.getByRole("heading", { name: "No trips yet" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Watched trips" })).toBeNull();
    const state = container.querySelector(".pp-state");
    expect(within(state as HTMLElement).getAllByRole("link")).toHaveLength(1);
    expect(
      within(state as HTMLElement).getByRole("link", { name: "Plan a trip" }),
    ).toBeTruthy();
  });

  test("loading and error keep the heading and invent no trips", () => {
    const { unmount } = render(
      <TripsScreen model={{ ...fixtureTrips, status: "loading" }} />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Watched trips" })).toBeNull();
    unmount();

    render(<TripsScreen model={{ ...fixtureTrips, status: "error" }} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/failure on our side/)).toBeTruthy();
  });
});

describe("live /trips route", () => {
  test("renders the empty state and no synthetic trips", async () => {
    vi.mocked(readApi).mockResolvedValue({ ok: true, value: { trips: [] } });
    render(await TripsLivePage());
    expect(screen.getByRole("heading", { name: "No trips yet" })).toBeTruthy();
    expect(screen.queryByText(/Example /)).toBeNull();
    expect(screen.queryByText("Order changed")).toBeNull();
  });

  test("an API failure is an error, never an empty shelf", async () => {
    vi.mocked(readApi).mockResolvedValue({ ok: false, reason: "unavailable" });
    render(await TripsLivePage());
    expect(screen.getByText("We could not load your trips")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "No trips yet" })).toBeNull();
  });
});

describe("trips accessibility", () => {
  test("has no axe violations in every state", async () => {
    const models = [
      fixtureTrips,
      emptyTrips,
      { ...fixtureTrips, status: "loading" as const },
      { ...fixtureTrips, status: "error" as const },
    ];
    for (const model of models) {
      const { container, unmount } = render(<TripsScreen model={model} />);
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });

  test("moving the journey chips does not touch the trip list", async () => {
    const user = userEvent.setup();
    render(<TripsScreen model={fixtureTrips} />);

    const before = screen.getAllByRole("listitem").length;
    await user.click(screen.getByRole("radio", { name: "Arrived" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(before);
  });
});
