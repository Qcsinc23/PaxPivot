import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import ComparePage from "@/app/trips/[tripId]/compare/page";
import { CompareScreen } from "@/components/screens/compare/CompareScreen";
import { known, unknown } from "@/lib/presentation/fact";
import {
  emptyCompare,
  fixtureCompare,
} from "@/lib/presentation/screens/compare";
import { expectNoAxeViolations } from "../a11y";

/** The cell holding a given field's value for a given option column. */
function cell(rowLabel: string, columnIndex: number): HTMLTableCellElement {
  const row = screen.getByRole("rowheader", { name: rowLabel }).closest("tr");
  const cells = within(row as HTMLElement).getAllByRole("cell");
  return cells[columnIndex] as HTMLTableCellElement;
}

describe("CompareScreen", () => {
  test("is a real table with a caption, column headers and row headers", () => {
    render(<CompareScreen model={fixtureCompare} />);

    const table = screen.getByRole("table", { name: fixtureCompare.title });
    // One corner/field header plus one column per option.
    expect(within(table).getAllByRole("columnheader")).toHaveLength(
      fixtureCompare.options.length + 1,
    );
    expect(within(table).getAllByRole("rowheader")).toHaveLength(
      fixtureCompare.rows.length,
    );
    expect(table.querySelector("caption")?.textContent).toBe(
      fixtureCompare.title,
    );
  });

  test("names each option column with its headline and a link", () => {
    render(<CompareScreen model={fixtureCompare} />);

    expect(screen.getByText("Best Space-A")).toBeTruthy();
    expect(screen.getByText("Option 2")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: fixtureCompare.options[0]!.title })
        .getAttribute("href"),
    ).toBe(fixtureCompare.options[0]!.href);
  });

  test("labels a commercial column as the baseline it is", () => {
    render(
      <CompareScreen
        model={{
          ...fixtureCompare,
          options: [
            { ...fixtureCompare.options[0]!, headline: "safest_overall" },
            fixtureCompare.options[1]!,
          ],
        }}
      />,
    );
    expect(screen.getByText("Safest overall")).toBeTruthy();
    expect(screen.queryByText("Best Space-A")).toBeNull();
  });

  test("the cell text conveys the value whatever the emphasis", () => {
    render(<CompareScreen model={fixtureCompare} />);

    // Every row's values are present as text.
    for (const row of fixtureCompare.rows) {
      expect(screen.getByRole("rowheader", { name: row.label })).toBeTruthy();
      for (const [index, item] of row.cells.entries()) {
        const expected =
          item.value.status === "known" ? item.value.value : "Unknown";
        expect(cell(row.label, index).textContent).toContain(expected);
      }
    }
  });

  test("emphasis is styling only: better is bold, tie is muted but fully opaque", () => {
    render(<CompareScreen model={fixtureCompare} />);

    const better = cell("Known cost", 0);
    const tie = cell("Handoffs", 0);
    const none = cell("Known cost", 1);

    expect(better.style.fontWeight).toBe("700");
    expect(tie.style.fontWeight).toBe("");

    // Dimmed by colour, never by transparency: the text stays readable.
    expect(tie.style.color).toBe("var(--color-neutral-700)");
    expect(tie.style.opacity === "" || Number(tie.style.opacity) >= 0.6).toBe(
      true,
    );
    expect(none.style.fontWeight).toBe("");
    expect(none.style.color).toBe("");
  });

  test("an unknown cell is never promoted or demoted by the screen", () => {
    render(
      <CompareScreen
        model={{
          ...fixtureCompare,
          rows: [
            {
              id: "cost",
              label: "Known cost",
              cells: [
                { value: unknown("Provider quote failed"), emphasis: "none" },
                { value: known("$10"), emphasis: "none" },
              ],
            },
          ],
        }}
      />,
    );

    const unknownCell = cell("Known cost", 0);
    expect(unknownCell.textContent).toContain("Unknown");
    // The model said "none", so no emphasis is applied — the screen decided nothing.
    expect(unknownCell.style.fontWeight).toBe("");
    expect(unknownCell.style.color).toBe("");
    // And it is not styled as the winner.
    expect(cell("Known cost", 1).style.fontWeight).toBe("");
  });

  test("shows source evidence for cells that carry it, and none otherwise", () => {
    render(<CompareScreen model={fixtureCompare} />);
    expect(screen.getByText("Fresh 9m")).toBeTruthy();
    expect(screen.getByText("Stale 3d")).toBeTruthy();
    // The cost row has no evidence, so it contributes no badge.
    expect(cell("Known cost", 0).querySelector(".pp-pill")).toBeNull();
    expect(cell("Handoffs", 0).querySelector(".pp-pill")).toBeTruthy();
  });

  test("renders the trade card and decided-by line from the model only", () => {
    const trade = "Fixture trade wording that the screen did not invent.";
    const decidedBy = "Fixture deciding field.";
    const { unmount } = render(
      <CompareScreen model={{ ...fixtureCompare, trade, decidedBy }} />,
    );
    expect(screen.getByRole("heading", { name: "The trade" })).toBeTruthy();
    expect(screen.getByText(trade)).toBeTruthy();
    expect(screen.getByText(`Decided by ${decidedBy}`)).toBeTruthy();
    unmount();

    render(
      <CompareScreen
        model={{ ...fixtureCompare, trade: undefined, decidedBy: undefined }}
      />,
    );
    expect(screen.queryByRole("heading", { name: "The trade" })).toBeNull();
    expect(screen.queryByText(/Decided by/)).toBeNull();
  });

  test("scrolls the table inside its own container, not the page", () => {
    const { container } = render(<CompareScreen model={fixtureCompare} />);
    const scroller =
      container.querySelector<HTMLElement>("table")?.parentElement;
    expect(scroller?.style.overflowX).toBe("auto");
  });

  test("offers Watch both and Open as sticky actions", () => {
    render(<CompareScreen model={fixtureCompare} />);
    const actions = screen.getByRole("group", { name: "Comparison actions" });
    expect(
      within(actions)
        .getByRole("link", { name: "Watch both" })
        .getAttribute("href"),
    ).toBe(fixtureCompare.actions.watchAllHref);
    expect(
      within(actions).getByRole("link", { name: "Open" }).getAttribute("href"),
    ).toBe(fixtureCompare.actions.openHref);
  });

  test("drops Watch both when the model has no watch target", () => {
    render(
      <CompareScreen
        model={{
          ...fixtureCompare,
          actions: { openHref: fixtureCompare.actions.openHref },
        }}
      />,
    );
    expect(screen.queryByRole("link", { name: "Watch both" })).toBeNull();
    expect(screen.getByRole("link", { name: "Open" })).toBeTruthy();
  });
});

describe("CompareScreen states", () => {
  test("empty renders one action and no table", () => {
    const { container } = render(<CompareScreen model={emptyCompare} />);
    expect(
      screen.getByRole("heading", { name: "Nothing to compare yet" }),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    const state = container.querySelector(".pp-state");
    expect(within(state as HTMLElement).getAllByRole("link")).toHaveLength(1);
  });

  test("loading and error keep the heading and claim nothing", () => {
    const { unmount } = render(
      <CompareScreen model={{ ...fixtureCompare, status: "loading" }} />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    unmount();

    render(<CompareScreen model={{ ...fixtureCompare, status: "error" }} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/failure on our side/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("live /trips/[tripId]/compare route", () => {
  test("renders the empty state and no synthetic comparison", () => {
    render(<ComparePage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Compare routes",
    );
    expect(
      screen.getByRole("heading", { name: "Nothing to compare yet" }),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/Example /)).toBeNull();
    expect(screen.queryByText("$10")).toBeNull();
  });
});

describe("accessibility", () => {
  test("has no axe violations", async () => {
    const { container } = render(<CompareScreen model={fixtureCompare} />);
    await expectNoAxeViolations(container, ["region"]);
  });

  test("has no axe violations in the empty, loading and error states", async () => {
    for (const status of ["empty", "loading", "error"] as const) {
      const model =
        status === "empty" ? emptyCompare : { ...fixtureCompare, status };
      const { container, unmount } = render(<CompareScreen model={model} />);
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });
});
