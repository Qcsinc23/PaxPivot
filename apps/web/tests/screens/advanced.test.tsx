import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import AdvancedLivePage from "@/app/advanced/page";
import ShowcaseDesktopCompositionPage from "@/app/showcase/advanced/desktop/page";
import { SourceHealthScreen } from "@/components/screens/advanced/SourceHealthScreen";
import { SplitLayout } from "@/components/screens/desktop/SplitLayout";
import { MOBILE_NAV, RAIL_SECONDARY } from "@/lib/presentation/navigation";
import {
  emptySourceHealth,
  fixtureSourceHealth,
} from "@/lib/presentation/screens/advanced";
import { fixtureResults } from "@/lib/presentation/screens/results";
import { expectNoAxeViolations } from "../a11y";

const HEADERS = [
  "Source",
  "State",
  "Page time",
  "We read it",
  "Cadence",
  "Reader",
];

/** Text a sighted user sees: direct text nodes only, so sr-only reasons are excluded. */
function visibleText(node: Element | null | undefined): string {
  if (!node) return "";
  return Array.from(node.childNodes)
    .filter((child) => child.nodeType === Node.TEXT_NODE)
    .map((child) => child.textContent ?? "")
    .join("")
    .trim();
}

/** Visible value in a table cell, by its row header and column index. */
function cell(rowName: string, columnIndex: number): HTMLTableCellElement {
  const row = screen
    .getByRole("rowheader", { name: new RegExp(rowName) })
    .closest("tr");
  const cells = within(row as HTMLElement).getAllByRole("cell");
  return cells[columnIndex] as HTMLTableCellElement;
}

describe("SourceHealthScreen", () => {
  test("is a real table with a caption and exactly the operational columns", () => {
    render(<SourceHealthScreen model={fixtureSourceHealth} />);

    const table = screen.getByRole("table", {
      name: "Source checks and their current state",
    });
    expect(table.querySelector("caption")?.textContent).toBe(
      "Source checks and their current state",
    );
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(HEADERS);
    expect(within(table).getAllByRole("rowheader")).toHaveLength(
      fixtureSourceHealth.rows.length,
    );
  });

  test("uses a source-state badge in every state cell", () => {
    const { container } = render(
      <SourceHealthScreen model={fixtureSourceHealth} />,
    );

    for (const row of fixtureSourceHealth.rows) {
      expect(cell(row.name, 0).querySelector(".pp-pill")).toBeTruthy();
    }
    // One badge per row's state cell, plus one per summary entry.
    expect(
      container.querySelectorAll(".pp-pill").length,
    ).toBeGreaterThanOrEqual(
      fixtureSourceHealth.rows.length + fixtureSourceHealth.summary.length,
    );
  });

  test("unknown page and read times read Unknown, never a substituted timestamp", () => {
    render(<SourceHealthScreen model={fixtureSourceHealth} />);

    const restricted = fixtureSourceHealth.rows.find(
      (row) => row.approval === "paused",
    );
    expect(restricted).toBeTruthy();
    // Page time, We read it, Cadence and Reader are all unknown for that source.
    for (const index of [1, 2, 3, 4]) {
      const td = cell(restricted?.name as string, index);
      // The value span carries no utility class in a table cell, so read its own text.
      expect(visibleText(td.firstElementChild ?? td)).toBe("Unknown");
    }
  });

  test("shows the processing approval for each source", () => {
    render(<SourceHealthScreen model={fixtureSourceHealth} />);

    const table = screen.getByRole("table", {
      name: "Source checks and their current state",
    });
    const counts = (text: string) => within(table).getAllByText(text).length;
    expect(counts("Approved")).toBe(
      fixtureSourceHealth.rows.filter((row) => row.approval === "approved")
        .length,
    );
    expect(counts("Needs review")).toBe(
      fixtureSourceHealth.rows.filter((row) => row.approval === "review")
        .length,
    );
    expect(counts("Paused")).toBe(
      fixtureSourceHealth.rows.filter((row) => row.approval === "paused")
        .length,
    );
  });

  test("says the screen is not needed unless something looks wrong", () => {
    render(<SourceHealthScreen model={fixtureSourceHealth} />);
    expect(
      screen.getByText(
        "You do not need this screen unless something looks wrong.",
      ),
    ).toBeTruthy();
  });

  test("renders the conflict, missing and restricted notices from the model", () => {
    render(<SourceHealthScreen model={fixtureSourceHealth} />);

    const notices = screen.getByRole("list", { name: "Source notices" });
    expect(within(notices).getAllByRole("listitem")).toHaveLength(
      fixtureSourceHealth.notices.length,
    );
    for (const notice of fixtureSourceHealth.notices) {
      expect(within(notices).getByText(notice.title)).toBeTruthy();
      expect(within(notices).getByText(notice.body)).toBeTruthy();
    }
    expect(
      screen.getByRole("heading", { name: "Needs attention" }),
    ).toBeTruthy();
  });

  test("reproduces no movement rows and no absence claim", () => {
    const { container } = render(
      <SourceHealthScreen model={fixtureSourceHealth} />,
    );
    const text = (container.textContent ?? "").toLowerCase();
    // The table has no movement columns at all; the operational set is exact.
    for (const forbidden of [
      "departs",
      "seats",
      "no flights",
      "none scheduled",
      "nothing flying",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  test("scrolls the table inside its own container", () => {
    const { container } = render(
      <SourceHealthScreen model={fixtureSourceHealth} />,
    );
    const scroller =
      container.querySelector<HTMLElement>("table")?.parentElement;
    expect(scroller?.style.overflowX).toBe("auto");
    expect(scroller?.style.contain).toBe("paint");
  });
});

describe("SplitLayout", () => {
  test("renders the list and the aside in order inside the split container", () => {
    const { container } = render(
      <SplitLayout list={<p>the list</p>} aside={<p>the map</p>} />,
    );

    const split = container.querySelector(".pp-split");
    expect(split).toBeTruthy();
    expect(split?.textContent).toBe("the listthe map");
    expect(screen.getByText("the list")).toBeTruthy();
    expect(screen.getByText("the map")).toBeTruthy();
  });

  test("declares minmax(0, 1fr) tracks and a 60rem breakpoint, and no fixed widths", () => {
    const css = readFileSync(
      join(process.cwd(), "styles", "screens.css"),
      "utf8",
    );

    const splitRule = css.slice(
      css.indexOf(".pp-split"),
      css.indexOf(".pp-topbar"),
    );
    expect(splitRule).toContain("minmax(0, 1fr)");
    expect(css).toContain("@media (min-width: 60rem)");
    expect(css).toContain(".pp-topbar");
    // No device-specific pixel widths anywhere in the wide-layout sheet.
    expect(/\d+px/.test(css)).toBe(false);
  });
});

describe("desktop composition showcase", () => {
  test("puts the results list beside the map with the top bar above them", () => {
    const { container } = render(<ShowcaseDesktopCompositionPage />);

    const split = container.querySelector(".pp-split");
    expect(split).toBeTruthy();
    expect(
      within(split as HTMLElement).getByRole("list", {
        name: "Space-A routes",
      }),
    ).toBeTruthy();
    expect(
      within(split as HTMLElement).getByRole("list", {
        name: "Locations on the map",
      }),
    ).toBeTruthy();

    expect(container.querySelector(".pp-topbar")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Sort routes" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ask/ })).toBeTruthy();
    for (const route of fixtureResults.routes) {
      expect(screen.getByText(route.title)).toBeTruthy();
    }
  });

  test("has no axe violations", async () => {
    const { container } = render(<ShowcaseDesktopCompositionPage />);
    await expectNoAxeViolations(container, ["region"]);
  });
});

describe("Advanced is rail-only", () => {
  test("never appears in the mobile navigation", () => {
    expect(MOBILE_NAV.map((destination) => destination.key)).not.toContain(
      "advanced",
    );
  });

  test("is reachable from the rail's secondary group", () => {
    const advanced = RAIL_SECONDARY.find(
      (destination) => destination.key === "advanced",
    );
    expect(advanced).toBeTruthy();
    // That destination is the route this task builds.
    render(<AdvancedLivePage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Source health",
    );
  });
});

describe("Advanced states and live route", () => {
  test("empty, loading and error claim nothing", () => {
    const { unmount } = render(
      <SourceHealthScreen model={emptySourceHealth} />,
    );
    expect(
      screen.getByRole("heading", { name: "No sources are being checked yet" }),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    unmount();

    const loading = render(
      <SourceHealthScreen
        model={{ ...fixtureSourceHealth, status: "loading" }}
      />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    loading.unmount();

    render(
      <SourceHealthScreen
        model={{ ...fixtureSourceHealth, status: "error" }}
      />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/failure on our side/)).toBeTruthy();
  });

  test("live /advanced renders the empty state and no synthetic sources", () => {
    render(<AdvancedLivePage />);
    expect(
      screen.getByRole("heading", { name: "No sources are being checked yet" }),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/Example /)).toBeNull();
  });
});

describe("accessibility", () => {
  test("has no axe violations in every state", async () => {
    const models = [
      fixtureSourceHealth,
      { ...fixtureSourceHealth, notices: [] },
      emptySourceHealth,
      { ...fixtureSourceHealth, status: "loading" as const },
      { ...fixtureSourceHealth, status: "error" as const },
    ];
    for (const model of models) {
      const { container, unmount } = render(
        <SourceHealthScreen model={model} />,
      );
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });
});
