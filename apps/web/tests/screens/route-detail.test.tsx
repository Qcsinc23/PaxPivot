import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import RouteDetailPage from "@/app/trips/[tripId]/routes/[routeId]/page";
import { RouteDetailScreen } from "@/components/screens/route-detail/RouteDetailScreen";
import { unknown } from "@/lib/presentation/fact";
import {
  emptyRouteDetail,
  fixtureRouteDetail,
} from "@/lib/presentation/screens/route-detail";
import { expectNoAxeViolations } from "../a11y";

/**
 * The visible tab panel. Role queries exclude the hidden panels, so scoping to this element
 * keeps an assertion from accidentally matching another tab's content.
 */
function panel(): HTMLElement {
  return screen.getByRole("tabpanel");
}

/** Text a sighted user sees: direct text nodes only, so sr-only reasons are excluded. */
function visibleText(node: Element | null | undefined): string {
  if (!node) return "";
  return Array.from(node.childNodes)
    .filter((child) => child.nodeType === Node.TEXT_NODE)
    .map((child) => child.textContent ?? "")
    .join("")
    .trim();
}

/** Visible value rendered next to a fact's label inside the current panel. */
function value(label: string): string {
  const dd = within(panel()).getByText(label).nextElementSibling;
  return visibleText(dd?.querySelector(".pp-fact__n") ?? dd);
}

describe("RouteDetailScreen tabs", () => {
  test("is exactly Overview, Evidence, Fallback, History — with no Journey tab", () => {
    render(<RouteDetailScreen model={fixtureRouteDetail} />);

    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Overview", "Evidence", "Fallback", "History"]);
    expect(screen.queryByRole("tab", { name: "Journey" })).toBeNull();
  });

  test("opens on the model's initial tab with roving tabindex intact", () => {
    const { unmount } = render(
      <RouteDetailScreen model={fixtureRouteDetail} initialTab="history" />,
    );
    const history = screen.getByRole("tab", { name: "History" });
    expect(history.getAttribute("aria-selected")).toBe("true");
    expect(history.getAttribute("tabindex")).toBe("0");
    expect(
      screen.getByRole("tab", { name: "Overview" }).getAttribute("tabindex"),
    ).toBe("-1");
    unmount();

    // An unrecognised initial tab falls back to the first tab rather than breaking.
    render(<RouteDetailScreen model={fixtureRouteDetail} initialTab="nope" />);
    expect(
      screen
        .getByRole("tab", { name: "Overview" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });
});

describe("Overview tab", () => {
  test("shows the map, the stats, the headline and the ranking reason", () => {
    render(<RouteDetailScreen model={fixtureRouteDetail} />);

    expect(
      within(panel()).getByRole("list", { name: "Locations on the map" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      fixtureRouteDetail.title,
    );
    expect(
      within(panel()).getByText(fixtureRouteDetail.rankingReason),
    ).toBeTruthy();
    expect(within(panel()).getByText("Best Space-A")).toBeTruthy();
    for (const stat of fixtureRouteDetail.stats) {
      expect(within(panel()).getByText(stat.label)).toBeTruthy();
    }
    expect(value("Known cost")).toBe("$10");
  });

  test("an unknown stat reads Unknown and never a zero", () => {
    render(
      <RouteDetailScreen
        model={{
          ...fixtureRouteDetail,
          stats: [
            { label: "Known cost", value: unknown("Fare not published") },
            { label: "Handoffs", value: unknown() },
          ],
        }}
      />,
    );

    expect(value("Known cost")).toBe("Unknown");
    expect(value("Handoffs")).toBe("Unknown");
    // The reason is announced rather than the value being silently blanked.
    expect(panel().textContent).toContain("Fare not published");
    for (const substitute of ["$0", "0 min", "None", "N/A"]) {
      expect(within(panel()).queryByText(substitute)).toBeNull();
    }
  });

  test("renders the journey in the supplied order, complete", () => {
    render(<RouteDetailScreen model={fixtureRouteDetail} />);

    const journey = within(panel()).getByRole("list", { name: "Journey" });
    const titles = within(journey)
      .getAllByRole("listitem")
      .map((item) => item.querySelector(".pp-leg__title")?.textContent);
    expect(titles).toEqual(fixtureRouteDetail.legs.map((leg) => leg.title));
  });

  test("shows the unresolved condition as an Unknown line when supplied", () => {
    const { unmount } = render(
      <RouteDetailScreen model={fixtureRouteDetail} />,
    );
    expect(
      within(panel()).getByText(fixtureRouteDetail.unresolved as string),
    ).toBeTruthy();
    unmount();

    render(
      <RouteDetailScreen
        model={{ ...fixtureRouteDetail, unresolved: undefined }}
      />,
    );
    expect(within(panel()).queryByText("Unknown:")).toBeNull();
  });

  test("offers the prepare action in a sticky bar, plus watch when supplied", () => {
    render(<RouteDetailScreen model={fixtureRouteDetail} />);

    const actions = within(panel()).getByRole("group", {
      name: "Route actions",
    });
    expect(
      within(actions)
        .getByRole("link", { name: "Prepare for this route" })
        .getAttribute("href"),
    ).toBe(fixtureRouteDetail.actions.prepareHref);
    expect(
      within(actions).getByRole("link", { name: "Watch" }).getAttribute("href"),
    ).toBe(fixtureRouteDetail.actions.watchHref);
  });

  test("drops the watch action when the model has none", () => {
    render(
      <RouteDetailScreen
        model={{
          ...fixtureRouteDetail,
          actions: { prepareHref: fixtureRouteDetail.actions.prepareHref },
        }}
      />,
    );
    const actions = within(panel()).getByRole("group", {
      name: "Route actions",
    });
    expect(within(actions).queryByRole("link", { name: "Watch" })).toBeNull();
    expect(
      within(actions).getByRole("link", { name: "Prepare for this route" }),
    ).toBeTruthy();
  });
});

describe("Evidence tab", () => {
  test("keeps the page's own time separate from our read time", () => {
    render(
      <RouteDetailScreen model={fixtureRouteDetail} initialTab="evidence" />,
    );

    expect(
      within(panel()).getByText(fixtureRouteDetail.evidence.sourceName),
    ).toBeTruthy();
    expect(within(panel()).getByText("Page says")).toBeTruthy();
    expect(within(panel()).getByText("We read it")).toBeTruthy();
    expect(within(panel()).getByText("Ago")).toBeTruthy();
    expect(within(panel()).getByText("14:02Z")).toBeTruthy();
    expect(within(panel()).getByText("15:44Z")).toBeTruthy();
    expect(value("Page says")).toBe("14:02Z");
    expect(value("We read it")).toBe("15:44Z");
  });

  test("an unknown source time reads Unknown rather than borrowing the read time", () => {
    render(
      <RouteDetailScreen
        model={{
          ...fixtureRouteDetail,
          evidence: {
            ...fixtureRouteDetail.evidence,
            age: {
              ...fixtureRouteDetail.evidence.age,
              sourceTime: unknown("Page shows no timestamp"),
            },
          },
        }}
        initialTab="evidence"
      />,
    );

    expect(value("Page says")).toBe("Unknown");
    // Our read time is unaffected and still shown.
    expect(value("We read it")).toBe("15:44Z");
  });

  test("opens the source and shows the evidence rows and the record note", () => {
    render(
      <RouteDetailScreen model={fixtureRouteDetail} initialTab="evidence" />,
    );

    expect(
      within(panel())
        .getByRole("link", { name: "Open source" })
        .getAttribute("href"),
    ).toBe(fixtureRouteDetail.evidence.openHref);
    expect(
      within(panel()).getByRole("list", { name: "Evidence" }),
    ).toBeTruthy();
    for (const row of fixtureRouteDetail.evidence.rows) {
      expect(within(panel()).getByText(row.label)).toBeTruthy();
    }
    expect(
      within(panel()).getByText(/record of what a page showed/),
    ).toBeTruthy();
  });

  test("offers a way to report the record as wrong", () => {
    render(
      <RouteDetailScreen model={fixtureRouteDetail} initialTab="evidence" />,
    );
    expect(
      within(panel())
        .getByRole("link", { name: "Report this as wrong" })
        .getAttribute("href"),
    ).toBe(fixtureRouteDetail.evidence.reportHref);
  });
});

describe("Fallback tab", () => {
  test("renders a fallback-labelled commercial handoff with the mandatory label", () => {
    render(
      <RouteDetailScreen model={fixtureRouteDetail} initialTab="fallback" />,
    );

    const pills = Array.from(panel().querySelectorAll(".pp-pill")).map(
      (pill) => pill.textContent ?? "",
    );
    expect(pills.some((text) => text.startsWith("Fallback"))).toBe(true);
    expect(pills.some((text) => text.startsWith("Safest overall"))).toBe(false);
    expect(within(panel()).getByText(/Live handoff/)).toBeTruthy();
    expect(within(panel()).getByText("Open provider search")).toBeTruthy();
  });

  test("lists the other ways out from the model", () => {
    render(
      <RouteDetailScreen model={fixtureRouteDetail} initialTab="fallback" />,
    );

    const others = within(panel()).getByRole("list", {
      name: "Other ways out",
    });
    expect(within(others).getAllByRole("listitem")).toHaveLength(
      fixtureRouteDetail.fallback.others.length,
    );
    expect(
      within(panel()).getByRole("heading", { name: "Other ways out" }),
    ).toBeTruthy();
  });

  test("renders no fallback card at all when the model has none", () => {
    render(
      <RouteDetailScreen
        model={{ ...fixtureRouteDetail, fallback: { others: [] } }}
        initialTab="fallback"
      />,
    );
    expect(panel().querySelectorAll(".pp-pill")).toHaveLength(0);
    expect(
      within(panel()).queryByRole("heading", { name: "Other ways out" }),
    ).toBeNull();
    expect(within(panel()).queryByText(/Live handoff/)).toBeNull();
  });
});

describe("History tab", () => {
  test("shows descriptive counts and the methodology link, with no chart", () => {
    const { container } = render(
      <RouteDetailScreen model={fixtureRouteDetail} initialTab="history" />,
    );

    expect(
      within(panel()).getByText(/Observed 11 times in 90 successful checks/),
    ).toBeTruthy();
    expect(within(panel()).getByText("Median published seats")).toBeTruthy();
    expect(
      within(panel())
        .getByRole("link", { name: "About these numbers" })
        .getAttribute("href"),
    ).toBe(fixtureRouteDetail.history.methodologyHref);
    // No chart of any kind in this task.
    expect(container.querySelector("canvas")).toBeNull();
  });

  test("never renders interpretive wording", () => {
    render(
      <RouteDetailScreen model={fixtureRouteDetail} initialTab="history" />,
    );
    const text = (panel().textContent ?? "").toLowerCase();
    for (const forbidden of [
      "usually available",
      "likely",
      "chance",
      "probability",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  test("an unknown history reads Unknown rather than zero", () => {
    render(
      <RouteDetailScreen
        model={{
          ...fixtureRouteDetail,
          history: {
            ...fixtureRouteDetail.history,
            observed: unknown("Not enough approved observations"),
            successfulChecks: unknown(),
            medianSeats: unknown(),
          },
        }}
        initialTab="history"
      />,
    );

    expect(within(panel()).getByText(/Observation count unknown/)).toBeTruthy();
    expect(within(panel()).queryByText("0")).toBeNull();
  });
});

describe("RouteDetailScreen states", () => {
  test("empty renders one action and no tabs", () => {
    const { container } = render(
      <RouteDetailScreen model={emptyRouteDetail} />,
    );
    expect(
      screen.getByRole("heading", { name: "No route to show yet" }),
    ).toBeTruthy();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    const state = container.querySelector(".pp-state");
    expect(within(state as HTMLElement).getAllByRole("link")).toHaveLength(1);
  });

  test("loading and error keep the route identity and claim nothing", () => {
    const { unmount } = render(
      <RouteDetailScreen
        model={{ ...fixtureRouteDetail, status: "loading" }}
      />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      fixtureRouteDetail.title,
    );
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    unmount();

    render(
      <RouteDetailScreen model={{ ...fixtureRouteDetail, status: "error" }} />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/failure on our side/)).toBeTruthy();
  });
});

describe("live route detail route", () => {
  test("renders the empty state and no synthetic detail", () => {
    render(<RouteDetailPage />);
    expect(
      screen.getByRole("heading", { name: "No route to show yet" }),
    ).toBeTruthy();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryByText(/Example /)).toBeNull();
    expect(screen.queryByText("Best Space-A")).toBeNull();
  });
});

describe("accessibility", () => {
  test("has no axe violations on any tab", async () => {
    for (const tab of ["overview", "evidence", "fallback", "history"]) {
      const { container, unmount } = render(
        <RouteDetailScreen model={fixtureRouteDetail} initialTab={tab} />,
      );
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });

  test("has no axe violations in the empty, loading and error states", async () => {
    for (const status of ["empty", "loading", "error"] as const) {
      const model =
        status === "empty"
          ? emptyRouteDetail
          : { ...fixtureRouteDetail, status };
      const { container, unmount } = render(
        <RouteDetailScreen model={model} />,
      );
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });
});

describe("route sticky action lifecycle", () => {
  test("marks the body only while Overview is the visible tab, and cleans up on unmount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <RouteDetailScreen model={fixtureRouteDetail} />,
    );

    // Overview active: the route action is present and the Ask action is suppressed.
    expect(
      within(panel()).getByRole("group", { name: "Route actions" }),
    ).toBeTruthy();
    expect(document.body.dataset.stickyBar).toBe("true");

    for (const name of ["Evidence", "Fallback", "History"]) {
      await user.click(screen.getByRole("tab", { name }));
      expect(screen.queryByRole("group", { name: "Route actions" })).toBeNull();
      expect(document.body.dataset.stickyBar, name).toBeUndefined();
    }

    // Switching back restores the action and the suppression.
    await user.click(screen.getByRole("tab", { name: "Overview" }));
    expect(
      within(panel()).getByRole("group", { name: "Route actions" }),
    ).toBeTruthy();
    expect(document.body.dataset.stickyBar).toBe("true");

    unmount();
    expect(document.body.dataset.stickyBar).toBeUndefined();
  });

  test("opening on another tab never marks the body", () => {
    render(
      <RouteDetailScreen model={fixtureRouteDetail} initialTab="history" />,
    );
    expect(document.body.dataset.stickyBar).toBeUndefined();
    expect(screen.queryByRole("group", { name: "Route actions" })).toBeNull();
  });

  test("the body mark is what hides the floating Ask action", () => {
    const css = readFileSync(
      join(process.cwd(), "styles", "components.css"),
      "utf8",
    );
    expect(css).toMatch(/body\[data-sticky-bar\] \.pp-fab \{\s*display: none;/);
  });
});
