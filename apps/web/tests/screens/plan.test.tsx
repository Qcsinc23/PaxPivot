import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import PlanPage from "@/app/page";
import { PlanScreen } from "@/components/screens/plan/PlanScreen";
import { unknown } from "@/lib/presentation/fact";
import { emptyPlan, fixturePlan } from "@/lib/presentation/screens/plan";
import type { PlanScreenModel } from "@/lib/presentation/screens/plan";
import { expectNoAxeViolations } from "../a11y";

/** Text a sighted user sees: direct text nodes only, so sr-only reasons are excluded. */
function visibleText(node: Element | null | undefined): string {
  if (!node) return "";
  return Array.from(node.childNodes)
    .filter((child) => child.nodeType === Node.TEXT_NODE)
    .map((child) => child.textContent ?? "")
    .join("")
    .trim();
}

/** Visible value rendered next to a fact's label. */
function factValue(label: string): string {
  const dd = screen.getByText(label).nextElementSibling;
  return visibleText(dd?.querySelector(".pp-fact__n") ?? dd);
}

describe("PlanScreen", () => {
  test("renders the question, the traveler-facing eligibility pill and the next action", () => {
    render(<PlanScreen model={fixturePlan} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Plan");
    expect(
      screen.getByRole("heading", { level: 2, name: "Where to?" }),
    ).toBeTruthy();
    expect(screen.getByText("Eligible · 2 travelers")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Find routes" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Watching" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Nearby terminals" }),
    ).toBeTruthy();
  });

  test("eligibility wording comes from the state and the count, not from a literal", () => {
    const single: PlanScreenModel = {
      ...fixturePlan,
      eligibility: { state: "unknown", travelerCount: 1 },
    };
    render(<PlanScreen model={single} />);

    expect(screen.getByText("Eligibility unknown · 1 traveler")).toBeTruthy();
    expect(screen.queryByText(/Eligible · 2 travelers/)).toBeNull();
  });

  test("ineligible and out-of-scope states read as their own text", () => {
    const { unmount } = render(
      <PlanScreen
        model={{
          ...fixturePlan,
          eligibility: { state: "ineligible", travelerCount: 3 },
        }}
      />,
    );
    expect(screen.getByText("Not eligible · 3 travelers")).toBeTruthy();
    unmount();

    render(
      <PlanScreen
        model={{
          ...fixturePlan,
          eligibility: { state: "outside_supported_scope", travelerCount: 2 },
        }}
      />,
    );
    expect(
      screen.getByText("Outside supported scope · 2 travelers"),
    ).toBeTruthy();
  });

  test("the sort control is driven by the model and defaults to Recommended", () => {
    const { unmount } = render(<PlanScreen model={fixturePlan} />);
    const recommended = screen.getByRole("radio", {
      name: "Recommended",
    }) as HTMLInputElement;
    expect(recommended.checked).toBe(true);
    // Every label comes from the foundation's sort vocabulary.
    for (const label of ["Fastest", "Lowest known cost", "Fewest handoffs"]) {
      expect(screen.getByRole("radio", { name: label })).toBeTruthy();
    }
    unmount();

    render(<PlanScreen model={{ ...fixturePlan, sort: "fewest_handoffs" }} />);
    expect(
      (
        screen.getByRole("radio", {
          name: "Fewest handoffs",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (screen.getByRole("radio", { name: "Recommended" }) as HTMLInputElement)
        .checked,
    ).toBe(false);
  });

  test("unknown origin, window and access values read Unknown, never zero or None", () => {
    render(
      <PlanScreen
        model={{
          ...fixturePlan,
          origin: unknown("No origin set"),
          window: unknown(),
          nearbyTerminals: fixturePlan.nearbyTerminals.map((terminal) => ({
            ...terminal,
            accessText: unknown(),
          })),
        }}
      />,
    );

    expect(factValue("From")).toBe("Unknown");
    expect(factValue("Window")).toBe("Unknown");
    expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(4);
    for (const substitute of ["0", "0 min", "None", "N/A", "$0"]) {
      expect(screen.queryByText(substitute)).toBeNull();
    }
  });

  test("watched trips and nearby terminals render as labelled lists", () => {
    render(<PlanScreen model={fixturePlan} />);

    const trips = screen.getByRole("list", { name: "Watched trips" });
    expect(within(trips).getAllByRole("listitem")).toHaveLength(1);
    expect(within(trips).getByText(fixturePlan.watching[0]!.name)).toBeTruthy();

    const terminals = screen.getByRole("list", { name: "Nearby terminals" });
    expect(within(terminals).getAllByRole("listitem")).toHaveLength(2);
    expect(
      within(terminals).getByText(fixturePlan.nearbyTerminals[0]!.name),
    ).toBeTruthy();
  });
});

describe("TripSettingsSheet", () => {
  test("is closed until asked for, then opens as a labelled dialog", async () => {
    const user = userEvent.setup();
    render(<PlanScreen model={fixturePlan} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Trip settings" }));

    const sheet = screen.getByRole("dialog", { name: "Trip settings" });
    expect(within(sheet).getByText("Access limits")).toBeTruthy();
    expect(
      within(sheet).getByRole("progressbar", { name: "Max drive" }),
    ).toBeTruthy();
    expect(
      within(sheet).getByRole("progressbar", { name: "Max transit" }),
    ).toBeTruthy();
    expect(within(sheet).getByText("Max drive")).toBeTruthy();
    expect(
      within(sheet).getByRole("link", { name: "Why the sponsor rule applies" }),
    ).toBeTruthy();
  });

  test("positioning toggles carry On/Off as text, not colour", async () => {
    const user = userEvent.setup();
    render(<PlanScreen model={fixturePlan} />);
    await user.click(screen.getByRole("button", { name: "Trip settings" }));

    const choices = screen.getByRole("list", { name: "Positioning choices" });
    const rows = within(choices).getAllByRole("listitem");
    expect(rows).toHaveLength(fixturePlan.settings.toggles.length);
    expect(within(rows[0]!).getByText("On")).toBeTruthy();
    expect(within(rows[1]!).getByText("Off")).toBeTruthy();

    const party = screen.getByRole("list", { name: "Travel party" });
    expect(within(party).getAllByRole("listitem")).toHaveLength(
      fixturePlan.settings.party.length,
    );
  });

  test("offers Reset and Apply in a labelled action bar", async () => {
    const user = userEvent.setup();
    render(<PlanScreen model={fixturePlan} />);
    await user.click(screen.getByRole("button", { name: "Trip settings" }));

    const actions = screen.getByRole("group", {
      name: "Trip settings actions",
    });
    expect(within(actions).getByRole("button", { name: "Reset" })).toBeTruthy();
    expect(within(actions).getByRole("button", { name: "Apply" })).toBeTruthy();
  });

  test("an unset limit shows no bar rather than a zero bar", async () => {
    const user = userEvent.setup();
    render(
      <PlanScreen
        model={{
          ...fixturePlan,
          settings: {
            ...fixturePlan.settings,
            transitLimit: { value: unknown("No transit limit set") },
          },
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Trip settings" }));

    expect(screen.getByRole("progressbar", { name: "Max drive" })).toBeTruthy();
    expect(
      screen.queryByRole("progressbar", { name: "Max transit" }),
    ).toBeNull();
    expect(
      within(screen.getByRole("dialog")).getByText("Unknown"),
    ).toBeTruthy();
  });

  test("does not suppress the floating Ask action while it is closed", async () => {
    const user = userEvent.setup();
    render(<PlanScreen model={fixturePlan} />);

    // Foundation contract: StickyActionBar marks the body so the Ask FAB steps aside.
    expect(document.body.dataset.stickyBar).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Trip settings" }));
    expect(document.body.dataset.stickyBar).toBe("true");

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(document.body.dataset.stickyBar).toBeUndefined();
  });
});

describe("PlanScreen states", () => {
  test("empty shows one line and one action, and invents no trips", () => {
    const { container } = render(<PlanScreen model={emptyPlan} />);

    expect(
      screen.getByRole("heading", { name: "Nothing planned yet" }),
    ).toBeTruthy();
    // Exactly one explanatory line, and it stays honest that planning is not wired yet.
    const lines = container.querySelectorAll(".pp-state p");
    expect(lines).toHaveLength(1);
    expect(lines[0]?.textContent).toContain(
      "Journey planning is not available yet.",
    );
    expect(screen.queryByRole("list", { name: "Watched trips" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Nearby terminals" })).toBeNull();
    expect(screen.queryByText(/Example/)).toBeNull();
    // Nothing to find yet: the only action leads somewhere live, never back into the loop.
    expect(screen.queryByRole("link", { name: "Find routes" })).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "See supported terminals" })
        .getAttribute("href"),
    ).toBe("/terminals");
  });

  test("loading keeps identity and shows the last known sources rather than replacing them", () => {
    render(
      <PlanScreen
        model={{
          ...fixturePlan,
          status: "loading",
          sourcesUpdated: { state: "source_stale", ageText: "3d" },
        }}
      />,
    );

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Last known sources")).toBeTruthy();
    expect(screen.getByText("Stale 3d")).toBeTruthy();
    expect(screen.queryByText("Nothing planned yet")).toBeNull();
  });

  test("error reports a failure on our side and never an absence of flights", () => {
    render(<PlanScreen model={{ ...fixturePlan, status: "error" }} />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/failure on our side/)).toBeTruthy();
    for (const forbidden of [
      "No flights",
      "no flights",
      "None scheduled",
      "Nothing flying",
    ]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });
});

describe("live / route", () => {
  test("renders the honest empty model and leaks no fixture data", () => {
    render(<PlanPage />);

    expect(
      screen.getByRole("heading", { name: "Nothing planned yet" }),
    ).toBeTruthy();
    // The live route keeps the scaffold's honesty guarantee that planning is not available.
    expect(
      screen.getByText(/Journey planning is not available yet/),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Watching" })).toBeNull();
    expect(screen.queryByText(/Example/)).toBeNull();
    expect(screen.queryByText("Eligible · 2 travelers")).toBeNull();
    expect(screen.queryByText("Sources updated")).toBeNull();
  });
});

describe("accessibility", () => {
  test("has no axe violations", async () => {
    const { container } = render(<PlanScreen model={fixturePlan} />);
    await expectNoAxeViolations(container, ["region"]);
  });

  test("has no axe violations with the settings sheet open", async () => {
    const user = userEvent.setup();
    const { container } = render(<PlanScreen model={fixturePlan} />);
    await user.click(screen.getByRole("button", { name: "Trip settings" }));
    await expectNoAxeViolations(container, ["region"]);
  });

  test("has no axe violations in the empty, loading and error states", async () => {
    const { container, unmount } = render(<PlanScreen model={emptyPlan} />);
    await expectNoAxeViolations(container, ["region"]);
    unmount();

    const loading = render(
      <PlanScreen model={{ ...fixturePlan, status: "loading" }} />,
    );
    await expectNoAxeViolations(loading.container, ["region"]);
    loading.unmount();

    const error = render(
      <PlanScreen model={{ ...fixturePlan, status: "error" }} />,
    );
    await expectNoAxeViolations(error.container, ["region"]);
  });

  test("an unknown fact carries the application's reason for assistive technology", () => {
    render(
      <PlanScreen
        model={{ ...fixturePlan, origin: unknown("No origin set") }}
      />,
    );

    const rendered = screen.getByText("From").nextElementSibling;
    expect(visibleText(rendered?.querySelector(".pp-fact__n"))).toBe("Unknown");
    // The reason is hidden visually but announced, so "Unknown" is never unexplained.
    expect(rendered?.textContent).toContain("No origin set");
  });
});
