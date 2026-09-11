import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { TerminalDetailScreen } from "@/components/screens/terminals/TerminalDetailScreen";
import { TerminalNetworkScreen } from "@/components/screens/terminals/TerminalNetworkScreen";
import { unknown } from "@/lib/presentation/fact";
import {
  emptyTerminalDetail,
  emptyTerminalNetwork,
  fixtureTerminalDetail,
  fixtureTerminalNetwork,
} from "@/lib/presentation/screens/terminals";
import { expectNoAxeViolations } from "../a11y";

/** The visible tab panel; role queries exclude the hidden ones. */
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

/** Visible value of a stat or fact, by its label. */
function valueOf(label: string): string {
  const dd = screen.getByText(label).nextElementSibling;
  return visibleText(dd?.querySelector(".pp-fact__n") ?? dd);
}

describe("TerminalNetworkScreen", () => {
  test("shows the reachable/excluded summary and the map's accessible list", () => {
    render(<TerminalNetworkScreen model={fixtureTerminalNetwork} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Terminals",
    );
    expect(screen.getByText("Reachable 12")).toBeTruthy();
    expect(screen.getByText("Excluded 3")).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "Locations on the map" }),
    ).toBeTruthy();
  });

  test("unknown counts read Unknown, never zero", () => {
    render(
      <TerminalNetworkScreen
        model={{
          ...fixtureTerminalNetwork,
          summary: { reachable: unknown("Not computed"), excluded: unknown() },
        }}
      />,
    );
    expect(screen.getByText("Reachable Unknown")).toBeTruthy();
    expect(screen.getByText("Excluded Unknown")).toBeTruthy();
    expect(screen.queryByText("Reachable 0")).toBeNull();
    expect(screen.queryByText("Excluded 0")).toBeNull();
  });

  test("offers the filter control without filtering the supplied list itself", async () => {
    const user = userEvent.setup();
    render(<TerminalNetworkScreen model={fixtureTerminalNetwork} />);

    const group = screen.getByRole("group", { name: "Terminals to show" });
    expect(
      (
        within(group).getByRole("radio", {
          name: "Reachable",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);

    const before = screen.getAllByRole("listitem").length;
    await user.click(within(group).getByRole("radio", { name: "Excluded" }));
    // The screen reports the filter; the application supplies the list.
    expect(screen.getAllByRole("listitem")).toHaveLength(before);
    expect(screen.getByRole("list", { name: "Terminals" })).toBeTruthy();
  });

  test("renders each terminal as a card with its entrance wording", () => {
    render(<TerminalNetworkScreen model={fixtureTerminalNetwork} />);

    const terminals = screen.getByRole("list", { name: "Terminals" });
    expect(within(terminals).getAllByRole("listitem")).toHaveLength(
      fixtureTerminalNetwork.terminals.length,
    );
    expect(within(terminals).getByText("Entrance verified")).toBeTruthy();
    expect(within(terminals).getByText("Entrance unverified")).toBeTruthy();
  });

  test("opens a labelled sheet for the selected terminal", async () => {
    const user = userEvent.setup();
    render(<TerminalNetworkScreen model={fixtureTerminalNetwork} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Selected terminal")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Details" }));

    const sheet = screen.getByRole("dialog", {
      name: fixtureTerminalNetwork.selected?.terminal.name,
    });
    expect(within(sheet).getByText("From you")).toBeTruthy();
    expect(within(sheet).getByText("35 min drive")).toBeTruthy();
    // The rule wording is the application's, and history stays descriptive.
    const selected = fixtureTerminalNetwork.selected;
    expect(within(sheet).getByText(selected?.ruleText as string)).toBeTruthy();
    expect(
      within(sheet).getByText(/Observed 11 times in 90 successful checks/),
    ).toBeTruthy();
    expect(sheet.textContent?.toLowerCase()).not.toContain(
      "historically useful",
    );
  });

  test("offers no selection affordance when the model selects nothing", () => {
    render(
      <TerminalNetworkScreen
        model={{ ...fixtureTerminalNetwork, selected: undefined }}
      />,
    );
    expect(screen.queryByText("Selected terminal")).toBeNull();
    expect(screen.queryByRole("button", { name: "Details" })).toBeNull();
  });
});

describe("TerminalDetailScreen", () => {
  test("leads with the map hero, the name, its state and the meta line", () => {
    render(<TerminalDetailScreen model={fixtureTerminalDetail} />);

    const terminal = fixtureTerminalDetail.terminal;
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      terminal.name,
    );
    expect(
      screen.getByRole("list", { name: "Locations on the map" }),
    ).toBeTruthy();
    expect(screen.getByText(/Example Joint Base/)).toBeTruthy();
    expect(screen.getByText("35 min drive")).toBeTruthy();
    // The terminal's own source state is on the header.
    expect(screen.getAllByText("Fresh 9m").length).toBeGreaterThan(0);
  });

  test("shows four stats, with unknown reading Unknown", () => {
    render(<TerminalDetailScreen model={fixtureTerminalDetail} />);

    for (const stat of fixtureTerminalDetail.stats) {
      expect(screen.getByText(stat.label)).toBeTruthy();
    }
    expect(screen.getByText("Verified entrance on record")).toBeTruthy();
    // The parking stat is unknown: it says so rather than becoming a zero.
    expect(valueOf("Parking")).toBe("Unknown");
    expect(screen.queryByText("0")).toBeNull();
  });

  test("carries the handoff label on the directions action only", () => {
    render(<TerminalDetailScreen model={fixtureTerminalDetail} />);

    const directions = screen.getByRole("link", { name: /Directions/ });
    expect(directions.getAttribute("href")).toBe(
      fixtureTerminalDetail.actions.directionsHref,
    );
    const row = directions.closest(".pp-card__hd");
    expect(row?.textContent).toContain("Live handoff");
    // The official source link is not a handoff.
    const official = screen.getByRole("link", { name: "Official page" });
    expect(official.closest(".pp-card__hd")).toBeNull();
  });

  test("is exactly Overview, Travel, Evidence, History", () => {
    render(<TerminalDetailScreen model={fixtureTerminalDetail} />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Overview",
      "Travel",
      "Evidence",
      "History",
    ]);
  });

  test("a superseded or withdrawn opportunity shows its own state, never as current", () => {
    render(<TerminalDetailScreen model={fixtureTerminalDetail} />);

    const opportunities = within(panel()).getByRole("list", {
      name: "Published opportunities",
    });
    const pills = Array.from(opportunities.querySelectorAll(".pp-pill")).map(
      (pill) => pill.textContent ?? "",
    );
    expect(pills.some((text) => text.startsWith("Superseded"))).toBe(true);
    expect(pills.some((text) => text.startsWith("Withdrawn"))).toBe(true);
    expect(pills.some((text) => text.startsWith("Fresh"))).toBe(true);
    expect(
      within(panel()).getByText(/not a reservation or a guaranteed seat/),
    ).toBeTruthy();
  });

  test("travel lists the supplied options and handoffs", () => {
    render(
      <TerminalDetailScreen
        model={fixtureTerminalDetail}
        initialTab="travel"
      />,
    );

    expect(
      within(panel()).getByRole("list", { name: "Travel options" }),
    ).toBeTruthy();
    const handoffs = within(panel()).getByRole("list", {
      name: "Provider handoffs",
    });
    expect(within(handoffs).getAllByRole("listitem")).toHaveLength(
      fixtureTerminalDetail.travel.handoffs.length,
    );
    // Each provider row states what that provider leaves unconfirmed; nothing is inferred.
    const labels = within(handoffs)
      .getAllByText(/Live handoff/)
      .map((label) => label.textContent);
    expect(labels).toEqual([
      "Live handoff · availability unknown",
      "Live handoff · schedule unknown",
    ]);
    expect(labels.join(" ")).not.toContain("fare");
  });

  test("evidence keeps the page time apart from the read time and explains inclusion", () => {
    render(
      <TerminalDetailScreen
        model={fixtureTerminalDetail}
        initialTab="evidence"
      />,
    );

    expect(within(panel()).getByText("Page says")).toBeTruthy();
    expect(within(panel()).getByText("We read it")).toBeTruthy();
    expect(
      within(panel()).getByRole("list", { name: "Evidence" }),
    ).toBeTruthy();

    const disclosure = panel().querySelector("details");
    expect(disclosure).toBeTruthy();
    expect(disclosure?.hasAttribute("open")).toBe(false);
    expect(disclosure?.textContent).toContain(
      fixtureTerminalDetail.evidence.whyIncluded,
    );
  });

  test("history stays descriptive and links to the methodology", () => {
    render(
      <TerminalDetailScreen
        model={fixtureTerminalDetail}
        initialTab="history"
      />,
    );

    expect(
      within(panel()).getByText(/Observed 11 times in 90 successful checks/),
    ).toBeTruthy();
    expect(
      within(panel()).getByRole("link", { name: "About these numbers" }),
    ).toBeTruthy();
    const text = (panel().textContent ?? "").toLowerCase();
    for (const forbidden of ["historically useful", "likely", "usually"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  test("links to comparing nearby terminals", () => {
    render(<TerminalDetailScreen model={fixtureTerminalDetail} />);
    expect(
      screen
        .getByRole("link", { name: "Compare nearby terminals" })
        .getAttribute("href"),
    ).toBe(fixtureTerminalDetail.compareHref);
  });
});

describe("terminal states", () => {
  test("network empty renders one action and no terminal list", () => {
    render(<TerminalNetworkScreen model={emptyTerminalNetwork} />);
    expect(
      screen.getByRole("heading", { name: "No terminals yet" }),
    ).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Terminals" })).toBeNull();
    expect(screen.queryByText(/Example/)).toBeNull();
  });

  test("network loading and error claim nothing", () => {
    const { unmount } = render(
      <TerminalNetworkScreen
        model={{ ...fixtureTerminalNetwork, status: "loading" }}
      />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Terminals" })).toBeNull();
    unmount();

    render(
      <TerminalNetworkScreen
        model={{ ...fixtureTerminalNetwork, status: "error" }}
      />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/failure on our side/)).toBeTruthy();
  });

  test("detail empty, loading and error claim nothing", () => {
    const { unmount } = render(
      <TerminalDetailScreen model={emptyTerminalDetail} />,
    );
    expect(
      screen.getByRole("heading", { name: "No terminal to show yet" }),
    ).toBeTruthy();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    unmount();

    const loading = render(
      <TerminalDetailScreen
        model={{ ...fixtureTerminalDetail, status: "loading" }}
      />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    loading.unmount();

    render(
      <TerminalDetailScreen
        model={{ ...fixtureTerminalDetail, status: "error" }}
      />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/failure on our side/)).toBeTruthy();
  });
});

describe("accessibility", () => {
  test("network has no axe violations in every state", async () => {
    const models = [
      fixtureTerminalNetwork,
      { ...fixtureTerminalNetwork, selected: undefined },
      emptyTerminalNetwork,
      { ...fixtureTerminalNetwork, status: "loading" as const },
      { ...fixtureTerminalNetwork, status: "error" as const },
    ];
    for (const model of models) {
      const { container, unmount } = render(
        <TerminalNetworkScreen model={model} />,
      );
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });

  test("network has no axe violations with the terminal sheet open", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TerminalNetworkScreen model={fixtureTerminalNetwork} />,
    );
    await user.click(screen.getByRole("button", { name: "Details" }));
    await expectNoAxeViolations(container, ["region"]);
  });

  test("detail has no axe violations on every tab and in every state", async () => {
    for (const tab of ["overview", "travel", "evidence", "history"]) {
      const { container, unmount } = render(
        <TerminalDetailScreen model={fixtureTerminalDetail} initialTab={tab} />,
      );
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
    for (const status of ["empty", "loading", "error"] as const) {
      const model =
        status === "empty"
          ? emptyTerminalDetail
          : { ...fixtureTerminalDetail, status };
      const { container, unmount } = render(
        <TerminalDetailScreen model={model} />,
      );
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });
});
