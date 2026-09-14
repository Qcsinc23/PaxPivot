/**
 * Adapter and component tests for the commercial flight handoff (TASK-053). Page-level wiring
 * (rendering on the live `/trips/[tripId]` route, the forbidden-wording guard across the whole
 * page) is covered in `tests/screens/results.test.tsx`'s "live /trips/[tripId] route" block.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { CommercialHandoff } from "@/app/trips/[tripId]/CommercialHandoff";
import type { TripRead } from "@/lib/api/contracts";
import { toCommercialHandoffViewModel } from "@/lib/presentation/adapters/commercial-handoff";
import { expectNoAxeViolations } from "./a11y";

function trip(overrides: Partial<TripRead> = {}): TripRead {
  return {
    trip_id: "trip-1",
    origin_terminal_id: "terminal-1",
    origin_terminal_name: "Joint Base McGuire-Dix-Lakehurst Passenger Terminal",
    destination_text: "Naples, Italy",
    window_start: "2026-10-01T06:00:00Z",
    window_end: "2026-10-04T18:00:00Z",
    party_size: 2,
    created_at: "2026-09-11T12:00:00Z",
    ...overrides,
  };
}

describe("toCommercialHandoffViewModel", () => {
  test("carries the trip's destination, window, party and curated origin airports", () => {
    const model = toCommercialHandoffViewModel(trip());
    expect(model.facts).toEqual([
      {
        label: "Destination",
        value: { status: "known", value: "Naples, Italy" },
      },
      {
        label: "Window",
        value: {
          status: "known",
          value: "2026-10-01 06:00Z – 2026-10-04 18:00Z",
        },
      },
      { label: "Party", value: { status: "known", value: "2 travelers" } },
      {
        label: "Suggested origin airports",
        value: { status: "known", value: "PHL, TTN, EWR" },
      },
    ]);
    const query = new URL(model.prefilledHref).searchParams.get("q") ?? "";
    expect(query).toBe(
      "Flights to Naples, Italy from PHL, TTN, EWR on 2026-10-01 through 2026-10-04 for 2 travelers",
    );
    expect(model.plainHref).toBe("https://www.google.com/travel/flights");
  });

  test("an origin terminal with no curated entry gets no prefilled origin", () => {
    const model = toCommercialHandoffViewModel(
      trip({ origin_terminal_name: "Some New Terminal" }),
    );
    const airportsFact = model.facts.find(
      (f) => f.label === "Suggested origin airports",
    );
    expect(airportsFact?.value.status).toBe("unknown");
    const query = new URL(model.prefilledHref).searchParams.get("q") ?? "";
    expect(query).not.toContain(" from ");
    expect(query).toContain("Naples, Italy");
    // The plain fallback is still offered regardless of curation.
    expect(model.plainHref).toBe("https://www.google.com/travel/flights");
  });
});

describe("CommercialHandoff component", () => {
  test("shows the mandatory handoff label and every COM-003 caveat", () => {
    render(<CommercialHandoff model={toCommercialHandoffViewModel(trip())} />);

    expect(
      screen.getByText("Live handoff · availability and fare unknown"),
    ).toBeTruthy();
    expect(
      screen.getByText(/Google Flights may omit valid options/),
    ).toBeTruthy();
    expect(screen.getByText(/prefilled search may not match/)).toBeTruthy();
    expect(screen.getByText(/price Google shows is Google's/)).toBeTruthy();
    expect(screen.getByText(/self-transfer between flights/)).toBeTruthy();
    expect(
      screen.getByText(/curated suggestion PaxPivot has not verified/),
    ).toBeTruthy();
  });

  test("shows verification facts matching the trip", () => {
    render(<CommercialHandoff model={toCommercialHandoffViewModel(trip())} />);
    expect(screen.getByText("Naples, Italy")).toBeTruthy();
    expect(screen.getByText("2 travelers")).toBeTruthy();
    expect(screen.getByText("PHL, TTN, EWR")).toBeTruthy();
  });

  test("both links have the correct href and open safely in a new tab", () => {
    const model = toCommercialHandoffViewModel(trip());
    render(<CommercialHandoff model={model} />);

    const prefilled = screen.getByRole("link", {
      name: "Open Google Flights search",
    });
    expect(prefilled.getAttribute("href")).toBe(model.prefilledHref);
    expect(prefilled.getAttribute("target")).toBe("_blank");
    expect(prefilled.getAttribute("rel")).toBe("noopener noreferrer");

    const plain = screen.getByRole("link", {
      name: "Prefill wrong? Open a plain search",
    });
    expect(plain.getAttribute("href")).toBe(
      "https://www.google.com/travel/flights",
    );
    expect(plain.getAttribute("target")).toBe("_blank");
    expect(plain.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("an uncurated origin terminal still offers the plain link and reads Unknown for airports", () => {
    const model = toCommercialHandoffViewModel(
      trip({ origin_terminal_name: "Some New Terminal" }),
    );
    const { container } = render(<CommercialHandoff model={model} />);
    expect(within(container).getByText("Unknown")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Prefill wrong? Open a plain search" }),
    ).toBeTruthy();
  });

  test("never shows a currency or price pattern", () => {
    const { container } = render(
      <CommercialHandoff model={toCommercialHandoffViewModel(trip())} />,
    );
    expect(container.textContent ?? "").not.toMatch(/\$\s?\d/);
  });

  test("has no axe violations", async () => {
    const { container } = render(
      <CommercialHandoff model={toCommercialHandoffViewModel(trip())} />,
    );
    await expectNoAxeViolations(container, ["region"]);
  });
});
