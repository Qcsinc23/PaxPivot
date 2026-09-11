import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ConflictNotice } from "@/components/paxpivot/notices/ConflictNotice";
import { HonestAbsencePanel } from "@/components/paxpivot/notices/HonestAbsencePanel";
import { KeptResultNotice } from "@/components/paxpivot/notices/KeptResultNotice";
import { LateCheckNotice } from "@/components/paxpivot/notices/LateCheckNotice";
import { NotRankedNotice } from "@/components/paxpivot/notices/NotRankedNotice";
import { RefreshNotice } from "@/components/paxpivot/notices/RefreshNotice";
import { unknown } from "@/lib/presentation/fact";
import { fixtureNotices } from "@/lib/presentation/notices";
import { expectNoAxeViolations } from "./a11y";

/** Phrases that would turn a failed or empty check into a claim about the world. */
const FORBIDDEN = ["no flights", "none scheduled", "nothing flying"];

/** The vocabulary that asserts a source state. */
function stateTexts(container: HTMLElement): string {
  return Array.from(container.querySelectorAll(".pp-pill"))
    .map((pill) => pill.textContent ?? "")
    .join(" \n ");
}

describe("RefreshNotice", () => {
  test("reports progress and each source's own state", () => {
    const { container } = render(
      <RefreshNotice notice={fixtureNotices.refresh} />,
    );

    expect(screen.getByText("Checking 4 sources · 1 done")).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Sources checked" });
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("4");

    const sources = screen.getByRole("list", {
      name: "Sources being checked",
    });
    expect(within(sources).getAllByRole("listitem")).toHaveLength(
      fixtureNotices.refresh.sources.length,
    );
    // Each source carries a state pill, including the ones that have not reported yet.
    expect(stateTexts(container)).toContain("Fresh 9m");
    expect(stateTexts(container)).toContain("Stale 3d");
    expect(stateTexts(container)).toContain("Unavailable");
  });

  test("does not render an absence while a check is running", () => {
    const { container } = render(
      <RefreshNotice notice={fixtureNotices.refresh} />,
    );
    expect(container.textContent?.toLowerCase()).not.toContain("no flights");
  });
});

describe("KeptResultNotice", () => {
  test("keeps the previous result visible, dimmed and dated", () => {
    const { container } = render(
      <KeptResultNotice notice={fixtureNotices.kept} />,
    );

    expect(screen.getByText(fixtureNotices.kept.title)).toBeTruthy();
    expect(
      screen.getByText("Read 15:30Z · kept on screen while we re-check"),
    ).toBeTruthy();
    // Dimmed by the foundation's muted surface, not by hiding content.
    expect(container.querySelector('[data-tone="muted"]')).toBeTruthy();
    expect(screen.getByText("Space-A leg")).toBeTruthy();
  });

  test("shows the state the model reports, without upgrading it", () => {
    const { container } = render(
      <KeptResultNotice notice={fixtureNotices.kept} />,
    );
    expect(stateTexts(container)).toContain("Stale 3d");

    // A model that reports fresh evidence must read fresh: the notice never marks it itself.
    const { container: fresh } = render(
      <KeptResultNotice
        notice={{
          ...fixtureNotices.kept,
          evidence: { state: "fresh", ageText: "2m" },
        }}
      />,
    );
    expect(stateTexts(fresh)).toContain("Fresh 2m");
    expect(stateTexts(fresh)).not.toContain("Stale");
  });
});

describe("LateCheckNotice", () => {
  test("shows expected versus actual and says the last result stays stale", () => {
    render(<LateCheckNotice notice={fixtureNotices.late} />);

    expect(screen.getByText("Expected")).toBeTruthy();
    expect(screen.getByText("Every 30 min")).toBeTruthy();
    expect(screen.getByText("Late by")).toBeTruthy();
    expect(screen.getByText("18 min")).toBeTruthy();
    expect(screen.getByText(/stays on screen and is still stale/)).toBeTruthy();
  });

  test("keeps the application explanation behind a closed disclosure", () => {
    const { container } = render(
      <LateCheckNotice notice={fixtureNotices.late} />,
    );
    const disclosure = container.querySelector("details");
    expect(disclosure).toBeTruthy();
    expect(disclosure?.hasAttribute("open")).toBe(false);
    expect(container.querySelectorAll("details[open]")).toHaveLength(0);
    expect(screen.getByText("Why?")).toBeTruthy();
  });
});

describe("ConflictNotice", () => {
  test("lists both official claims with dates and holds them", () => {
    render(<ConflictNotice notice={fixtureNotices.conflict} />);

    const claims = screen.getByRole("list", { name: "Official claims" });
    expect(within(claims).getAllByRole("listitem")).toHaveLength(2);
    expect(within(claims).getByText("Departs 06:00")).toBeTruthy();
    expect(within(claims).getByText("Departs 07:30")).toBeTruthy();
    expect(within(claims).getByText("Official page · 2026-01-01")).toBeTruthy();
    expect(
      within(claims).getByText("Official notice · 2026-01-02"),
    ).toBeTruthy();
    expect(screen.getByText(/Held until a person decides/)).toBeTruthy();
  });
});

describe("NotRankedNotice", () => {
  test("shows the count, per-source states and the honest line", () => {
    const { container } = render(
      <NotRankedNotice notice={fixtureNotices.notRanked} />,
    );

    expect(screen.getByText("3 sources not ranked")).toBeTruthy();
    const rows = screen.getByRole("list", { name: "Sources not ranked" });
    expect(within(rows).getAllByRole("listitem")).toHaveLength(
      fixtureNotices.notRanked.rows.length,
    );
    expect(
      screen.getByText(
        "None of these states is evidence that nothing is flying.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "See what was checked" }),
    ).toBeTruthy();
    // Not being ranked is not the same as nothing existing.
    expect(stateTexts(container)).not.toContain("None published");
  });

  test("singular counts read as one source", () => {
    render(
      <NotRankedNotice notice={{ ...fixtureNotices.notRanked, count: 1 }} />,
    );
    expect(screen.getByText("1 source not ranked")).toBeTruthy();
  });
});

describe("HonestAbsencePanel", () => {
  test("renders what was checked, the best move and the commercial way out", () => {
    const { container } = render(
      <HonestAbsencePanel absence={fixtureNotices.absence} />,
    );

    expect(
      screen.getByRole("heading", { name: "No supported Space-A route yet" }),
    ).toBeTruthy();

    const summary = screen.getByRole("list", { name: "What the sources said" });
    expect(within(summary).getAllByRole("listitem")).toHaveLength(
      fixtureNotices.absence.summary.length,
    );
    expect(within(summary).getByText("2 sources")).toBeTruthy();
    // Two sources reported a count of one; each keeps its own state pill.
    expect(within(summary).getAllByText("1 source")).toHaveLength(2);

    expect(screen.getByRole("list", { name: "Sources checked" })).toBeTruthy();

    // Exactly one action on the best-move card.
    const bestMove = screen.getByText("Best move").closest("section");
    expect(bestMove).toBeTruthy();
    expect(within(bestMove as HTMLElement).getAllByRole("link")).toHaveLength(
      1,
    );
    expect(
      within(bestMove as HTMLElement).getByRole("link", {
        name: "Change the window",
      }),
    ).toBeTruthy();

    // The commercial option stays a handoff, never a PaxPivot fare.
    expect(screen.getByText(/Live handoff/)).toBeTruthy();
    expect(screen.getByText("Safest overall")).toBeTruthy();

    expect(container.querySelector('[data-tone="handoff"]')).toBeTruthy();
  });

  test("omits the commercial option when the model has none", () => {
    render(
      <HonestAbsencePanel
        absence={{ ...fixtureNotices.absence, commercial: undefined }}
      />,
    );
    expect(screen.queryByText("Safest overall")).toBeNull();
    expect(screen.queryByText(/Live handoff/)).toBeNull();
  });

  test("offers the explanation as a question, never as a claim", () => {
    const { container } = render(
      <HonestAbsencePanel absence={fixtureNotices.absence} />,
    );

    // Every mention of the phrasing lives inside the "why can't you just say it" affordance,
    // which is a link to the explanation — not a state and not a statement of absence.
    const why = screen.getByRole("link", {
      name: "Why not just say no flights?",
    });
    const text = container.textContent?.toLowerCase() ?? "";
    for (const forbidden of FORBIDDEN) {
      const outside = text
        .replaceAll(why.textContent?.toLowerCase() ?? "", "")
        .replaceAll(why.getAttribute("href")?.toLowerCase() ?? "", "");
      expect(outside).not.toContain(forbidden);
    }
  });
});

describe("state vocabulary never claims absence", () => {
  test("no state pill in any notice carries a forbidden phrase", () => {
    const notices = [
      <RefreshNotice key="r" notice={fixtureNotices.refresh} />,
      <KeptResultNotice key="k" notice={fixtureNotices.kept} />,
      <LateCheckNotice key="l" notice={fixtureNotices.late} />,
      <ConflictNotice key="c" notice={fixtureNotices.conflict} />,
      <NotRankedNotice key="n" notice={fixtureNotices.notRanked} />,
      <HonestAbsencePanel key="a" absence={fixtureNotices.absence} />,
    ];
    for (const notice of notices) {
      const { container, unmount } = render(notice);
      const states = stateTexts(container).toLowerCase();
      for (const forbidden of FORBIDDEN) {
        expect(states).not.toContain(forbidden);
      }
      // Unknown is a real state and stays visible, never dropped or zeroed.
      expect(container.textContent).not.toContain("None published");
      unmount();
    }
  });
});

describe("unknown handling", () => {
  test("unknown facts read Unknown, never zero", () => {
    render(
      <KeptResultNotice
        notice={{
          ...fixtureNotices.kept,
          facts: [
            { label: "Arrival", value: unknown("No published arrival") },
            { label: "Cost", value: unknown() },
          ],
        }}
      />,
    );

    expect(screen.getAllByText("Unknown")).toHaveLength(2);
    for (const substitute of ["0", "$0", "0 min", "None", "N/A"]) {
      expect(screen.queryByText(substitute)).toBeNull();
    }
  });
});

describe("accessibility", () => {
  test("no notice has axe violations", async () => {
    const notices = [
      <RefreshNotice key="r" notice={fixtureNotices.refresh} />,
      <KeptResultNotice key="k" notice={fixtureNotices.kept} />,
      <LateCheckNotice key="l" notice={fixtureNotices.late} />,
      <ConflictNotice key="c" notice={fixtureNotices.conflict} />,
      <NotRankedNotice key="n" notice={fixtureNotices.notRanked} />,
      <HonestAbsencePanel key="a" absence={fixtureNotices.absence} />,
    ];
    for (const notice of notices) {
      const { container, unmount } = render(notice);
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });
});
