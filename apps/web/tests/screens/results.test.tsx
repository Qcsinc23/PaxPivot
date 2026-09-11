import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ResultsPage from "@/app/trips/[tripId]/page";
import { readApi } from "@/lib/api/client";
import { ResultsScreen } from "@/components/screens/results/ResultsScreen";
import { unknown } from "@/lib/presentation/fact";
import {
  fixtureResults,
  fixtureResultsNoRoute,
  fixtureResultsRefreshing,
} from "@/lib/presentation/screens/results";
import { expectNoAxeViolations } from "../a11y";

vi.mock("@/lib/api/client", () => ({ readApi: vi.fn() }));

const readApiMock = vi.mocked(readApi);

beforeEach(() => {
  readApiMock.mockReset();
});

const BASELINE_TITLE = fixtureResults.baseline?.title ?? "";
const FIRST_ROUTE = fixtureResults.routes[0]?.title ?? "";
const SECOND_ROUTE = fixtureResults.routes[1]?.title ?? "";

/** Position of each needle in the rendered text — used to prove the screen preserves order. */
function positions(
  container: HTMLElement,
  needles: readonly string[],
): number[] {
  const text = container.textContent ?? "";
  return needles.map((needle) => text.indexOf(needle));
}

describe("ResultsScreen", () => {
  test("the header names the trip and offers back and filters", () => {
    render(<ResultsScreen model={fixtureResults} />);

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toContain(fixtureResults.title);
    expect(h1.textContent).toContain(fixtureResults.subtitle);
    expect(
      screen.getByRole("link", { name: "Back" }).getAttribute("href"),
    ).toBe("/trips");
    expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
  });

  test("puts the map first and always renders its list equivalent", () => {
    render(<ResultsScreen model={fixtureResults} />);
    expect(
      screen.getByRole("list", { name: "Locations on the map" }),
    ).toBeTruthy();
  });

  test("keeps the application's order: commercial baseline, then Space-A routes", () => {
    const { container } = render(<ResultsScreen model={fixtureResults} />);
    const [baseline, first, second] = positions(container, [
      BASELINE_TITLE,
      FIRST_ROUTE,
      SECOND_ROUTE,
    ]);

    expect(baseline).toBeGreaterThanOrEqual(0);
    expect(first!).toBeGreaterThanOrEqual(0);
    expect(second!).toBeGreaterThanOrEqual(0);
    expect(baseline!).toBeLessThan(first!);
    expect(first!).toBeLessThan(second!);
    // The commercial option is a different product, not another Space-A card.
    expect(container.querySelector('[data-tone="handoff"]')).toBeTruthy();
    expect(screen.getByText("Safest overall")).toBeTruthy();
  });

  test("changing the sort never reorders, filters or re-labels the supplied list", async () => {
    const user = userEvent.setup();
    const { container } = render(<ResultsScreen model={fixtureResults} />);

    const before = positions(container, [FIRST_ROUTE, SECOND_ROUTE]);
    expect(
      (screen.getByRole("radio", { name: "Recommended" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      screen.getAllByText(/Best Space-A|Option \d/).length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole("radio", { name: "Fewest handoffs" }));

    const after = positions(container, [FIRST_ROUTE, SECOND_ROUTE]);
    expect(after).toEqual(before);
    // The headline pills still come from the model, not from the new sort choice.
    expect(screen.getByText("Best Space-A")).toBeTruthy();
    expect(screen.getByText("Option 2")).toBeTruthy();
  });

  test("the sort control follows the model's own default", () => {
    render(<ResultsScreen model={{ ...fixtureResults, sort: "fastest" }} />);
    expect(
      (screen.getByRole("radio", { name: "Fastest" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (screen.getByRole("radio", { name: "Recommended" }) as HTMLInputElement)
        .checked,
    ).toBe(false);
  });

  test("links to the comparison screen from the model", () => {
    render(<ResultsScreen model={fixtureResults} />);
    expect(
      screen.getByRole("link", { name: "Compare all" }).getAttribute("href"),
    ).toBe(fixtureResults.compareHref);
  });

  test("no $0: unknown route values read Unknown, never a zero or None", () => {
    render(
      <ResultsScreen
        model={{
          ...fixtureResults,
          baseline: undefined,
          routes: [
            {
              ...fixtureResults.routes[0]!,
              knownCost: unknown("Fare not published"),
              facts: [
                { label: "Arrival", value: unknown() },
                { label: "Drive", value: unknown() },
              ],
            },
          ],
        }}
      />,
    );

    // Three unknowns: cost, arrival, drive. Each says so rather than becoming a number.
    expect(screen.getAllByText("Unknown")).toHaveLength(3);
    for (const substitute of ["$0", "0 min", "None", "N/A", "0"]) {
      expect(screen.queryByText(substitute)).toBeNull();
    }
  });

  test("renders the not-ranked strip from the model", () => {
    render(<ResultsScreen model={fixtureResults} />);
    const notRanked = screen
      .getByText("3 sources not ranked")
      .closest("section");
    expect(notRanked).toBeTruthy();
    expect(
      within(notRanked as HTMLElement).getByRole("list", {
        name: "Sources not ranked",
      }),
    ).toBeTruthy();
  });

  test("renders no refresh, kept, late or conflict notice unless the model provides one", () => {
    const { unmount } = render(<ResultsScreen model={fixtureResults} />);
    expect(screen.queryByText(/Checking \d+ sources/)).toBeNull();
    expect(screen.queryByText(/kept on screen while we re-check/)).toBeNull();
    expect(screen.queryByText(/Held until a person decides/)).toBeNull();
    unmount();

    render(<ResultsScreen model={fixtureResultsRefreshing} />);
    expect(screen.getByText("Checking 4 sources · 1 done")).toBeTruthy();
    expect(screen.getByText(/kept on screen while we re-check/)).toBeTruthy();
    expect(screen.getByText(/Held until a person decides/)).toBeTruthy();
    expect(screen.getByText(/stays on screen and is still stale/)).toBeTruthy();
    // The routes are still rendered alongside the notices, never replaced by them.
    expect(screen.getByText(FIRST_ROUTE)).toBeTruthy();
  });
});

describe("ResultsScreen no-route state", () => {
  test("shows the honest absence panel and never an empty route list", () => {
    const { container } = render(
      <ResultsScreen model={fixtureResultsNoRoute} />,
    );

    expect(
      screen.getByRole("heading", { name: "No supported Space-A route yet" }),
    ).toBeTruthy();
    expect(screen.getByRole("list", { name: "Sources checked" })).toBeTruthy();
    // No route cards: the only card here is the commercial handoff from the absence panel.
    for (const article of container.querySelectorAll("article")) {
      expect(article.getAttribute("data-tone")).toBe("handoff");
    }
    expect(screen.queryByText("Best Space-A")).toBeNull();
    expect(screen.queryByRole("link", { name: "View route" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Compare all" })).toBeNull();
    expect(screen.queryByText(FIRST_ROUTE)).toBeNull();
  });

  test("never states that nothing is flying", () => {
    const { container } = render(
      <ResultsScreen model={fixtureResultsNoRoute} />,
    );
    const text = (container.textContent ?? "").toLowerCase();
    for (const forbidden of ["none scheduled", "nothing flying"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("ResultsScreen loading and error states", () => {
  test("loading keeps the last result on screen instead of replacing it", () => {
    render(
      <ResultsScreen
        model={{
          ...fixtureResultsRefreshing,
          status: "loading",
          refresh: undefined,
        }}
      />,
    );

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/kept on screen while we re-check/)).toBeTruthy();
    expect(screen.queryByText(/No supported Space-A route/)).toBeNull();
  });

  test("error is a failure on our side, never an absence of routes", () => {
    render(<ResultsScreen model={{ ...fixtureResults, status: "error" }} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/failure on our side/)).toBeTruthy();
    expect(screen.getByText(/Nothing has been ruled out/)).toBeTruthy();
  });
});

describe("Why this order", () => {
  test("opens a labelled sheet with the comparator outcomes", async () => {
    const user = userEvent.setup();
    render(<ResultsScreen model={fixtureResults} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Why this order" }));

    const sheet = screen.getByRole("dialog", { name: "Why this order" });
    const steps = within(sheet).getByRole("list", { name: "Comparison steps" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(
      fixtureResults.whyOrder.steps.length,
    );
    expect(within(steps).getByText("Decided here")).toBeTruthy();
    expect(within(steps).getByText("Not needed")).toBeTruthy();
    expect(within(steps).getByText("Not used")).toBeTruthy();
  });

  test("marks the decisive field distinctly in text and tone", async () => {
    const user = userEvent.setup();
    render(<ResultsScreen model={fixtureResults} />);
    await user.click(screen.getByRole("button", { name: "Why this order" }));

    const decided = screen.getByText("Decided here").closest(".pp-pill");
    const notUsed = screen.getByText("Not used").closest(".pp-pill");
    expect(decided?.getAttribute("data-tone")).toBe("best");
    expect(notUsed?.getAttribute("data-tone")).toBe("ghost");
    expect(decided?.getAttribute("data-tone")).not.toBe(
      notUsed?.getAttribute("data-tone"),
    );
  });

  test("renders the note the model supplies, not wording invented here", async () => {
    const user = userEvent.setup();
    const note = "Fixture note: unknown time or cost never counts as zero.";
    render(
      <ResultsScreen
        model={{
          ...fixtureResults,
          whyOrder: { ...fixtureResults.whyOrder, note },
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Why this order" }));
    expect(screen.getByText(note)).toBeTruthy();
  });

  test("does not touch the page while it is closed", () => {
    render(<ResultsScreen model={fixtureResults} />);
    expect(document.body.dataset.stickyBar).toBeUndefined();
  });
});

describe("live /trips/[tripId] route", () => {
  test("renders the saved request and states that no route was searched", async () => {
    readApiMock.mockResolvedValue({
      ok: true,
      value: {
        trip_id: "6f1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7",
        origin_terminal_id: "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a",
        origin_terminal_name: "Registered Terminal",
        destination_text: "Somewhere",
        window_start: "2026-10-01T06:00:00Z",
        window_end: "2026-10-04T06:00:00Z",
        party_size: 2,
        created_at: "2026-09-11T12:00:00Z",
      },
    });
    render(
      await ResultsPage({
        params: Promise.resolve({
          tripId: "6f1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7",
        }),
      }),
    );

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Registered Terminal → Somewhere",
    );
    expect(screen.getByText("No routes searched yet")).toBeTruthy();
    expect(screen.queryByText(/Example /)).toBeNull();
    expect(screen.queryByText("Best Space-A")).toBeNull();
    expect(screen.queryByText("Safest overall")).toBeNull();
  });
});

describe("accessibility", () => {
  test("has no axe violations", async () => {
    const { container } = render(<ResultsScreen model={fixtureResults} />);
    await expectNoAxeViolations(container, ["region"]);
  });

  test("has no axe violations with the why-order sheet open", async () => {
    const user = userEvent.setup();
    const { container } = render(<ResultsScreen model={fixtureResults} />);
    await user.click(screen.getByRole("button", { name: "Why this order" }));
    await expectNoAxeViolations(container, ["region"]);
  });

  test("has no axe violations in the no-route, refreshing, loading and error states", async () => {
    const states = [
      fixtureResultsNoRoute,
      fixtureResultsRefreshing,
      { ...fixtureResults, status: "loading" as const },
      { ...fixtureResults, status: "error" as const },
    ];
    for (const model of states) {
      const { container, unmount } = render(<ResultsScreen model={model} />);
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });

  test("unknown route facts keep their reason for assistive technology", () => {
    const reason = "No published arrival";
    render(
      <ResultsScreen
        model={{
          ...fixtureResults,
          routes: [
            {
              ...fixtureResults.routes[0]!,
              facts: [{ label: "Arrival", value: unknown(reason) }],
            },
          ],
        }}
      />,
    );
    const rendered = screen.getByText("Arrival").nextElementSibling;
    expect(rendered?.textContent).toContain("Unknown");
    expect(rendered?.textContent).toContain(reason);
  });

  test("known facts still render their value", () => {
    render(<ResultsScreen model={fixtureResults} />);
    expect(
      screen.getByText("Space-A leg").nextElementSibling?.textContent,
    ).toBe("1");
  });
});
