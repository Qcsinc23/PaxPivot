import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AlertList } from "@/components/paxpivot/AlertRow";
import { CommercialBaselineCard } from "@/components/paxpivot/CommercialBaselineCard";
import { EvidenceAge } from "@/components/paxpivot/EvidenceAge";
import { HANDOFF_LABEL } from "@/components/paxpivot/Handoff";
import {
  HistoricalStats,
  historySentence,
} from "@/components/paxpivot/HistoricalStats";
import { JourneyTimeline } from "@/components/paxpivot/JourneyTimeline";
import { MapSurface } from "@/components/paxpivot/MapSurface";
import { ReadinessList } from "@/components/paxpivot/ReadinessItem";
import { RouteCard } from "@/components/paxpivot/RouteCard";
import {
  SourceStateBadge,
  SourceStateDisclosure,
} from "@/components/paxpivot/SourceStateBadge";
import { TerminalCard } from "@/components/paxpivot/TerminalCard";
import { TripCard } from "@/components/paxpivot/TripCard";
import { unknown } from "@/lib/presentation/fact";
import {
  fixtureAlerts,
  fixtureCandidate,
  fixtureCommercial,
  fixtureEvidenceAge,
  fixtureEvidenceAgeUnknownSource,
  fixtureHistory,
  fixtureHistoryUnknown,
  fixtureLegs,
  fixtureMap,
  fixtureReadiness,
  fixtureRoute,
  fixtureTerminalUnverified,
  fixtureTrip,
} from "@/lib/presentation/fixtures";
import {
  SOURCE_STATE_CODES,
  SOURCE_STATE_LEXICON,
  type SourceStateCode,
} from "@/lib/presentation/source-state";

describe("SourceStateBadge", () => {
  test.each(SOURCE_STATE_CODES)(
    "renders the lexicon label for %s and nothing else",
    (code) => {
      render(<SourceStateBadge evidence={{ state: code, ageText: "9m" }} />);
      const lexeme = SOURCE_STATE_LEXICON[code];
      expect(
        screen.getByText(`${lexeme.label} 9m`, { exact: false }).textContent,
      ).toBe(`${lexeme.label} 9m, ${lexeme.srText}`);
    },
  );

  test("does not invent a state for an unrecognised code", () => {
    render(
      <SourceStateBadge
        evidence={{ state: "confirmed_flight" as SourceStateCode }}
      />,
    );
    expect(screen.getByText(/Unknown state/)).toBeTruthy();
    expect(screen.queryByText(/Fresh/)).toBeNull();
  });

  test("keeps the long explanation behind a closed disclosure", () => {
    render(
      <SourceStateDisclosure
        evidence={{
          state: "source_stale",
          explanation: "Long deterministic text.",
        }}
      />,
    );
    const details = screen.getByText("Why?").closest("details");
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain("Long deterministic text.");
  });

  test("renders no disclosure when the application supplied no explanation", () => {
    const { container } = render(
      <SourceStateDisclosure evidence={{ state: "fresh" }} />,
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("EvidenceAge", () => {
  test("keeps source time and read time separate and never fills an unknown source time", () => {
    render(<EvidenceAge age={fixtureEvidenceAgeUnknownSource} />);
    expect(
      screen.getByText("Page says").nextElementSibling?.textContent,
    ).toMatch(/^Unknown/);
    expect(screen.getByText("We read it").nextElementSibling?.textContent).toBe(
      "15:44Z",
    );
    const times = document.querySelectorAll("time");
    expect(times).toHaveLength(1);
  });

  test("renders a known source time as a <time> element", () => {
    render(<EvidenceAge age={fixtureEvidenceAge} />);
    expect(document.querySelectorAll("time")).toHaveLength(2);
  });
});

describe("JourneyTimeline", () => {
  test("preserves the supplied leg order and marks dependencies", () => {
    render(<JourneyTimeline legs={fixtureLegs} />);
    const items = within(
      screen.getByRole("list", { name: "Journey" }),
    ).getAllByRole("listitem");
    expect(
      items.map((li) => li.querySelector(".pp-leg__title")?.textContent),
    ).toEqual(fixtureLegs.map((leg) => leg.title));
    expect(items[1]?.getAttribute("data-dependency")).toBe("space_a");
    expect(items[3]?.querySelector(".pp-leg__time")?.textContent).toMatch(
      /^Unknown/,
    );
  });

  test("does not sort legs", () => {
    const reversed = [...fixtureLegs].reverse();
    render(<JourneyTimeline legs={reversed} />);
    const titles = screen
      .getAllByRole("listitem")
      .map((li) => li.querySelector(".pp-leg__title")?.textContent);
    expect(titles).toEqual(reversed.map((leg) => leg.title));
  });
});

describe("RouteCard and CommercialBaselineCard", () => {
  test("unknown cost and facts read Unknown, never zero", () => {
    render(<RouteCard route={fixtureCandidate} />);
    const article = screen.getByRole("article", {
      name: fixtureCandidate.title,
    });
    expect(article.textContent).not.toMatch(/\$0\b/);
    expect(
      within(article).getAllByText("Unknown", { exact: false }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(within(article).getByText("Option 2")).toBeTruthy();
    expect(within(article).getByText("Seat state unresolved")).toBeTruthy();
  });

  test("best Space-A card exposes headline, reason and actions", () => {
    render(<RouteCard route={fixtureRoute} />);
    expect(screen.getByText("Best Space-A")).toBeTruthy();
    expect(screen.getByText(fixtureRoute.rankingReason)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "View route" }).getAttribute("href"),
    ).toBe(fixtureRoute.actions.viewHref);
  });

  test("commercial baseline is a distinct product with the mandatory handoff label", () => {
    render(<CommercialBaselineCard baseline={fixtureCommercial} />);
    expect(screen.getByText("Safest overall")).toBeTruthy();
    expect(screen.queryByText("Best Space-A")).toBeNull();
    expect(screen.getByText(HANDOFF_LABEL)).toBeTruthy();
    expect(screen.getByRole("article").getAttribute("data-tone")).toBe(
      "handoff",
    );
  });
});

describe("HistoricalStats", () => {
  test("describes counts with their denominator and never interprets", () => {
    render(<HistoricalStats history={fixtureHistory} />);
    expect(
      screen.getByText(
        "Observed 11 times in 90 successful checks, last 90 days.",
      ),
    ).toBeTruthy();
    const text =
      screen.getByRole("region", { name: "Observation history" }).textContent ??
      "";
    expect(text).not.toMatch(
      /useful|likely|chance|probab|reliab|forecast(?!\.)/i,
    );
  });

  test("unknown counts are not rendered as zero", () => {
    render(<HistoricalStats history={fixtureHistoryUnknown} />);
    expect(historySentence(fixtureHistoryUnknown)).toBe(
      "Observation count unknown for the last 90 days.",
    );
    const text =
      screen.getByRole("region", { name: "Observation history" }).textContent ??
      "";
    expect(text).not.toMatch(/\b0\b/);
    expect(text.match(/Unknown/g)?.length).toBeGreaterThanOrEqual(4);
  });
});

describe("MapSurface", () => {
  test("always renders a list equivalent including markers without coordinates", () => {
    render(<MapSurface map={fixtureMap} />);
    const list = screen.getByRole("list", { name: "Locations on the map" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(fixtureMap.markers.length);
    expect(list.textContent).toContain("Example Terminal D");
    expect(list.textContent).toContain("Unavailable · location unknown");
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
      "5 locations listed below",
    );
  });

  test("empty and error states stay honest", () => {
    render(
      <MapSurface
        map={{ ...fixtureMap, status: "error", markers: [], note: undefined }}
      />,
    );
    expect(screen.getByText("No locations to show yet.")).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
      "Map unavailable",
    );
  });
});

describe("TerminalCard, ReadinessList, AlertList, TripCard", () => {
  test("unverified entrance and unknown access are explicit", () => {
    render(<TerminalCard terminal={fixtureTerminalUnverified} />);
    expect(
      screen.getByText("Entrance unverified", { exact: false }),
    ).toBeTruthy();
    expect(
      screen.getAllByText("Unknown", { exact: false }).length,
    ).toBeGreaterThanOrEqual(2);
  });

  test("readiness statuses have text, not just icons", () => {
    render(<ReadinessList items={fixtureReadiness} />);
    expect(screen.getAllByText("Done")).toHaveLength(2);
    expect(screen.getByText("Due day 1")).toBeTruthy();
    expect(screen.getByText("Unresolved")).toBeTruthy();
  });

  test("alerts are one sentence, a timestamp and one action", () => {
    render(<AlertList alerts={fixtureAlerts} />);
    const rows = within(
      screen.getByRole("list", { name: "Alerts" }),
    ).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]?.querySelector("time")?.getAttribute("datetime")).toBe(
      fixtureAlerts[0]?.when.iso,
    );
    expect(
      within(rows[0] as HTMLElement).getByRole("link", { name: "View" }),
    ).toBeTruthy();
  });

  test("trip card summarises sources with state words", () => {
    render(<TripCard trip={fixtureTrip} />);
    expect(screen.getByText("2 fresh", { exact: false })).toBeTruthy();
    expect(screen.getByText("1 stale", { exact: false })).toBeTruthy();
    expect(screen.getByText("Order changed")).toBeTruthy();
  });

  test("a trip without a top route still renders", () => {
    render(
      <TripCard
        trip={{
          ...fixtureTrip,
          top: undefined,
          change: undefined,
          sources: [],
        }}
      />,
    );
    expect(
      screen.getByRole("article", { name: fixtureTrip.name }),
    ).toBeTruthy();
    expect(screen.queryByText("Best Space-A")).toBeNull();
  });

  test("fact helper for stat tiles keeps unknown notes for assistive tech", () => {
    render(
      <RouteCard
        route={{ ...fixtureRoute, knownCost: unknown("Fare not published") }}
      />,
    );
    expect(
      screen.getByText("Fare not published", { exact: false }),
    ).toBeTruthy();
  });
});
