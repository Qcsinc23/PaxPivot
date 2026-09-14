import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ResultsPage from "@/app/trips/[tripId]/page";
import { readApi } from "@/lib/api/client";
import type { ApiResult } from "@/lib/api/client";
import type {
  SourceEvidenceRead,
  TerminalDetailRead,
  TerminalNetworkRead,
  TerminalSourceRead,
  TerminalSummaryRead,
  TripRead,
} from "@/lib/api/contracts";
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

/**
 * TASK-044 fixtures: the page reads `/api/v1/trips/{id}`, `/api/v1/terminals` and one
 * `/api/v1/terminals/{id}` per registered terminal, so the mock must branch on path rather than
 * return one fixed value for every call.
 */
const TRIP_ID = "6f1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7";
const MDL_ID = "11111111-1111-4111-8111-111111111111";
const DOVER_ID = "22222222-2222-4222-8222-222222222222";
const BWI_ID = "33333333-3333-4333-8333-333333333333";
const ANDREWS_ID = "44444444-4444-4444-8444-444444444444";
const MDL_SCHEDULE_URL = "https://amc.example.mil/mdl/72hr-folder/";

function mockRoutes(routes: Record<string, ApiResult<unknown>>) {
  readApiMock.mockImplementation(((path: string) => {
    if (!(path in routes)) {
      throw new Error(`unexpected readApi(${path}) call in this test`);
    }
    return Promise.resolve(routes[path]);
  }) as typeof readApi);
}

function trip(originTerminalId: string, originName: string): TripRead {
  return {
    trip_id: TRIP_ID,
    origin_terminal_id: originTerminalId,
    origin_terminal_name: originName,
    destination_text: "Somewhere",
    window_start: "2026-10-01T06:00:00Z",
    window_end: "2026-10-04T06:00:00Z",
    party_size: 2,
    created_at: "2026-09-11T12:00:00Z",
  };
}

function evidence(
  overrides: Partial<SourceEvidenceRead> = {},
): SourceEvidenceRead {
  return {
    observation_id: "obs-1",
    state: "fresh",
    observed_at: "2026-09-14T11:30:00Z",
    source_time: "2026-09-14T11:00:00Z",
    retrieval: "succeeded",
    extraction: "exact_text",
    parser_version: "synthetic-parser-v1",
    explanation: "Synthetic explanation.",
    ...overrides,
  };
}

function terminalSummary(
  overrides: Partial<TerminalSummaryRead> &
    Pick<TerminalSummaryRead, "terminal_id" | "name">,
): TerminalSummaryRead {
  return {
    installation: null,
    timezone: "UTC",
    operational_state: "verified",
    entrance: null,
    entrance_kind: null,
    official_url: `https://example.invalid/${overrides.terminal_id}`,
    latest: evidence(),
    ...overrides,
  };
}

const mdl = terminalSummary({
  terminal_id: MDL_ID,
  name: "Joint Base MDL Passenger Terminal",
});
const dover = terminalSummary({
  terminal_id: DOVER_ID,
  name: "Dover AFB Passenger Terminal",
  latest: evidence({ state: "source_stale" }),
});
const bwi = terminalSummary({
  terminal_id: BWI_ID,
  name: "BWI AMC Passenger Terminal",
  latest: null,
});
const andrews = terminalSummary({
  terminal_id: ANDREWS_ID,
  name: "Joint Base Andrews Passenger Terminal",
  latest: evidence({ state: "source_changed_unparsed" }),
});

function scheduleSource(
  summary: TerminalSummaryRead,
  url: string,
): TerminalSourceRead {
  return {
    source_id: `${summary.terminal_id}-schedule`,
    name: `${summary.name} 72-hour schedule (AMC artifact)`,
    url,
    kind: "schedule_artifact",
    enabled: true,
    review_state: "restricted",
    latest: null,
  };
}

function terminalDetail(
  summary: TerminalSummaryRead,
  url: string,
): TerminalDetailRead {
  return {
    generated_at: "2026-09-14T12:00:00Z",
    summary,
    entrance_instructions: null,
    facts: [],
    sources: [scheduleSource(summary, url)],
  };
}

/** A state pill's own label, ignoring the age suffix and the sr-only elaboration. */
function pillLabel(scope: HTMLElement): string {
  return scope.querySelector(".pp-pill")?.firstChild?.textContent?.trim() ?? "";
}

describe("live /trips/[tripId] route", () => {
  test("lists every registered terminal, origin first, with an honest state and the registered schedule link", async () => {
    mockRoutes({
      [`/api/v1/trips/${TRIP_ID}`]: { ok: true, value: trip(MDL_ID, mdl.name) },
      // Deliberately not in origin-first or alphabetical order: the adapter orders, not the API.
      "/api/v1/terminals": {
        ok: true,
        value: {
          generated_at: "2026-09-14T12:00:00Z",
          terminals: [dover, bwi, andrews, mdl],
        } satisfies TerminalNetworkRead,
      },
      [`/api/v1/terminals/${MDL_ID}`]: {
        ok: true,
        value: terminalDetail(mdl, MDL_SCHEDULE_URL),
      },
      [`/api/v1/terminals/${DOVER_ID}`]: {
        ok: true,
        value: terminalDetail(
          dover,
          "https://amc.example.mil/dover/72hr-folder/",
        ),
      },
      [`/api/v1/terminals/${BWI_ID}`]: {
        ok: true,
        value: terminalDetail(bwi, "https://amc.example.mil/bwi/72hr-folder/"),
      },
      // A source failure never hides a terminal: Andrews' own detail read fails outright.
      [`/api/v1/terminals/${ANDREWS_ID}`]: { ok: false, reason: "unavailable" },
    });

    const { container } = render(
      await ResultsPage({ params: Promise.resolve({ tripId: TRIP_ID }) }),
    );

    expect(readApiMock).toHaveBeenCalledWith(`/api/v1/trips/${TRIP_ID}`);
    expect(readApiMock).toHaveBeenCalledWith("/api/v1/terminals");
    for (const id of [MDL_ID, DOVER_ID, BWI_ID, ANDREWS_ID]) {
      expect(readApiMock).toHaveBeenCalledWith(`/api/v1/terminals/${id}`);
    }

    // Origin first, regardless of the network payload's own order.
    const [mdlPos, doverPos, bwiPos, andrewsPos] = positions(container, [
      mdl.name,
      dover.name,
      bwi.name,
      andrews.name,
    ]);
    expect(mdlPos).toBeGreaterThanOrEqual(0);
    expect(mdlPos!).toBeLessThan(doverPos!);
    expect(mdlPos!).toBeLessThan(bwiPos!);
    expect(mdlPos!).toBeLessThan(andrewsPos!);

    expect(screen.getByText(/not a ranking/)).toBeTruthy();
    expect(
      screen.getByText("PaxPivot does not read departure schedules yet."),
    ).toBeTruthy();
    expect(screen.getByText(/not guaranteed/)).toBeTruthy();

    const mdlCard = screen
      .getByRole("heading", { name: mdl.name })
      .closest("article") as HTMLElement;
    expect(pillLabel(mdlCard)).toBe("Fresh");
    expect(
      within(mdlCard)
        .getByRole("link", {
          name: "72-hour schedule — open yourself",
        })
        .getAttribute("href"),
    ).toBe(MDL_SCHEDULE_URL);

    const doverCard = screen
      .getByRole("heading", { name: dover.name })
      .closest("article") as HTMLElement;
    expect(pillLabel(doverCard)).toBe("Stale");

    const bwiCard = screen
      .getByRole("heading", { name: bwi.name })
      .closest("article") as HTMLElement;
    expect(within(bwiCard).getByText("Not checked yet")).toBeTruthy();

    // Andrews' own detail read failed: the terminal still appears, with its network-reported
    // state intact, but the schedule link is honestly unavailable rather than absent or guessed.
    const andrewsCard = screen
      .getByRole("heading", { name: andrews.name })
      .closest("article") as HTMLElement;
    expect(pillLabel(andrewsCard)).toBe("Unreadable");
    expect(
      within(andrewsCard).queryByRole("link", { name: /72-hour schedule/ }),
    ).toBeNull();
    expect(
      within(andrewsCard).getByText(
        /could not load this terminal's schedule link/i,
      ),
    ).toBeTruthy();

    // The three not-yet-computed facts appear for every terminal, never as a zero or a guess.
    expect(screen.getAllByText("Destinations served")).toHaveLength(4);
    expect(screen.getAllByText("Drive time")).toHaveLength(4);

    expect(screen.queryByText("No routes searched yet")).toBeNull();
    expect(screen.queryByText(/Example /)).toBeNull();
    expect(screen.queryByText("Best Space-A")).toBeNull();
    expect(screen.queryByText("Safest overall")).toBeNull();
  });

  test("never renders forbidden wording: flights, departures, seats, probability or a chance of anything", async () => {
    mockRoutes({
      [`/api/v1/trips/${TRIP_ID}`]: { ok: true, value: trip(MDL_ID, mdl.name) },
      "/api/v1/terminals": {
        ok: true,
        value: {
          generated_at: "2026-09-14T12:00:00Z",
          terminals: [mdl, dover, bwi, andrews],
        } satisfies TerminalNetworkRead,
      },
      [`/api/v1/terminals/${MDL_ID}`]: {
        ok: true,
        value: terminalDetail(mdl, MDL_SCHEDULE_URL),
      },
      [`/api/v1/terminals/${DOVER_ID}`]: {
        ok: true,
        value: terminalDetail(
          dover,
          "https://amc.example.mil/dover/72hr-folder/",
        ),
      },
      [`/api/v1/terminals/${BWI_ID}`]: {
        ok: true,
        value: terminalDetail(bwi, "https://amc.example.mil/bwi/72hr-folder/"),
      },
      [`/api/v1/terminals/${ANDREWS_ID}`]: { ok: false, reason: "unavailable" },
    });

    const { container } = render(
      await ResultsPage({ params: Promise.resolve({ tripId: TRIP_ID }) }),
    );

    let text = container.textContent ?? "";
    // Two known, reviewed, legitimate occurrences: this page's own honest disclaimer, and the
    // shared SourceStateBadge accessibility text for the "fresh" state (unchanged foundation
    // wording, TASK-006). Strip them before checking for a real violation.
    const KNOWN_SAFE = [
      "PaxPivot does not read departure schedules yet.",
      "not a reservation or a seat",
    ];
    for (const safe of KNOWN_SAFE) {
      expect(text).toContain(safe);
      text = text.replace(safe, "");
    }
    for (const banned of [/\bflights?\b/i, /\bdepartures?\b/i, /\bseats?\b/i]) {
      expect(text).not.toMatch(banned);
    }
    for (const phrase of ["no flights", "probability", "chance of"]) {
      expect(text.toLowerCase()).not.toContain(phrase);
    }
  });

  test("has no axe violations on the terminals-to-check list", async () => {
    mockRoutes({
      [`/api/v1/trips/${TRIP_ID}`]: { ok: true, value: trip(MDL_ID, mdl.name) },
      "/api/v1/terminals": {
        ok: true,
        value: {
          generated_at: "2026-09-14T12:00:00Z",
          terminals: [mdl, dover, bwi, andrews],
        } satisfies TerminalNetworkRead,
      },
      [`/api/v1/terminals/${MDL_ID}`]: {
        ok: true,
        value: terminalDetail(mdl, MDL_SCHEDULE_URL),
      },
      [`/api/v1/terminals/${DOVER_ID}`]: {
        ok: true,
        value: terminalDetail(
          dover,
          "https://amc.example.mil/dover/72hr-folder/",
        ),
      },
      [`/api/v1/terminals/${BWI_ID}`]: {
        ok: true,
        value: terminalDetail(bwi, "https://amc.example.mil/bwi/72hr-folder/"),
      },
      [`/api/v1/terminals/${ANDREWS_ID}`]: { ok: false, reason: "unavailable" },
    });

    const { container } = render(
      await ResultsPage({ params: Promise.resolve({ tripId: TRIP_ID }) }),
    );
    await expectNoAxeViolations(container, ["region"]);
  });

  test("a failure loading the terminal network is a failure on our side, not an empty list", async () => {
    mockRoutes({
      [`/api/v1/trips/${TRIP_ID}`]: { ok: true, value: trip(MDL_ID, mdl.name) },
      "/api/v1/terminals": { ok: false, reason: "unavailable" },
    });

    render(await ResultsPage({ params: Promise.resolve({ tripId: TRIP_ID }) }));

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/failure on our side/)).toBeTruthy();
  });

  test("a malformed trip id is not found, never a failure on our side", async () => {
    readApiMock.mockResolvedValue({ ok: false, reason: "invalid" });
    await expect(
      ResultsPage({ params: Promise.resolve({ tripId: "0".repeat(36) }) }),
    ).rejects.toThrow("notFound");
    expect(readApiMock).not.toHaveBeenCalled();
    await expect(
      ResultsPage({
        params: Promise.resolve({
          tripId: "6f1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7",
        }),
      }),
    ).rejects.toThrow("notFound");
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
