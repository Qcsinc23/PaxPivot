import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import AlertsLivePage from "@/app/alerts/page";
import { AlertsScreen } from "@/components/screens/alerts/AlertsScreen";
import { emptyAlerts, fixtureAlerts } from "@/lib/presentation/screens/alerts";
import { expectNoAxeViolations } from "../a11y";

describe("AlertsScreen", () => {
  test("lists one row per alert, with a time and a single action each", () => {
    render(<AlertsScreen model={fixtureAlerts} />);

    const feed = screen.getByRole("list", { name: "Alerts" });
    const rows = within(feed).getAllByRole("listitem");
    expect(rows).toHaveLength(fixtureAlerts.alerts.length);

    for (const [index, alert] of fixtureAlerts.alerts.entries()) {
      const row = rows[index] as HTMLElement;
      expect(within(row).getByText(alert.title)).toBeTruthy();
      expect(within(row).getByText(alert.detail)).toBeTruthy();
      expect(within(row).getByText(alert.when.text)).toBeTruthy();
      // Exactly one action, and it goes where the model says.
      const actions = within(row).getAllByRole("link");
      expect(actions).toHaveLength(1);
      expect(actions[0]?.getAttribute("href")).toBe(alert.action.href);
      expect(actions[0]?.textContent).toBe(alert.action.label);
    }
  });

  test("the timestamp carries machine-readable time, not just text", () => {
    render(<AlertsScreen model={fixtureAlerts} />);
    const time = document.querySelector("time");
    expect(time?.getAttribute("dateTime")).toBe(
      fixtureAlerts.alerts[0]?.when.iso,
    );
  });

  test("the filter control reflects the model without filtering the feed", async () => {
    const user = userEvent.setup();
    render(<AlertsScreen model={fixtureAlerts} />);

    const group = screen.getByRole("group", { name: "Alert types" });
    for (const label of ["All", "Routes", "Sources", "Readiness"]) {
      expect(within(group).getByRole("radio", { name: label })).toBeTruthy();
    }
    expect(
      (within(group).getByRole("radio", { name: "All" }) as HTMLInputElement)
        .checked,
    ).toBe(true);

    const before = screen.getAllByRole("listitem").length;
    await user.click(within(group).getByRole("radio", { name: "Sources" }));
    // The screen reports the filter; the application supplies the feed.
    expect(screen.getAllByRole("listitem")).toHaveLength(before);
  });

  test("takes the filter the model supplies, not a default", () => {
    render(<AlertsScreen model={{ ...fixtureAlerts, filter: "readiness" }} />);
    const group = screen.getByRole("group", { name: "Alert types" });
    expect(
      (
        within(group).getByRole("radio", {
          name: "Readiness",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  test("explains the deliberately vague email behind a closed disclosure", async () => {
    const { container } = render(<AlertsScreen model={fixtureAlerts} />);

    expect(
      screen.getByRole("heading", {
        name: fixtureAlerts.emailNote.title,
      }),
    ).toBeTruthy();
    const disclosure = container.querySelector("details");
    expect(disclosure).toBeTruthy();
    expect(disclosure?.hasAttribute("open")).toBe(false);
    expect(disclosure?.textContent).toContain(fixtureAlerts.emailNote.body);

    // The note is the model's wording, not one baked into the screen.
    const body = "Fixture note: the email never names a movement.";
    const { unmount } = render(
      <AlertsScreen
        model={{
          ...fixtureAlerts,
          emailNote: { title: fixtureAlerts.emailNote.title, body },
        }}
      />,
    );
    expect(screen.getByText(body)).toBeTruthy();
    unmount();
  });

  test("offers labelled alert settings", () => {
    render(<AlertsScreen model={fixtureAlerts} />);
    expect(
      screen.getByRole("link", { name: "Alert settings" }).getAttribute("href"),
    ).toBe(fixtureAlerts.settingsHref);
  });

  test("an empty feed says so instead of implying nothing can change", () => {
    render(<AlertsScreen model={{ ...fixtureAlerts, alerts: [] }} />);
    expect(screen.getByText("No alerts of this kind right now.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Alerts" })).toBeNull();
  });
});

describe("AlertsScreen states", () => {
  test("empty reports nothing to report with a next action", () => {
    const { container } = render(<AlertsScreen model={emptyAlerts} />);

    expect(
      screen.getByRole("heading", { name: "Nothing to report" }),
    ).toBeTruthy();
    const state = container.querySelector(".pp-state");
    expect(within(state as HTMLElement).getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("list", { name: "Alerts" })).toBeNull();
  });

  test("error is a failure on our side, never 'nothing changed'", () => {
    render(<AlertsScreen model={{ ...fixtureAlerts, status: "error" }} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/failure on our side/)).toBeTruthy();
    expect(
      screen.getByText(/not a statement that nothing has changed/),
    ).toBeTruthy();
  });

  test("loading keeps identity", () => {
    render(<AlertsScreen model={{ ...fixtureAlerts, status: "loading" }} />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Alerts",
    );
  });
});

describe("live /alerts route", () => {
  test("renders the empty state and no synthetic alerts", () => {
    render(<AlertsLivePage />);
    expect(
      screen.getByRole("heading", { name: "Nothing to report" }),
    ).toBeTruthy();
    expect(screen.queryByText(/Example /)).toBeNull();
    expect(screen.queryByText("Route order changed")).toBeNull();
  });
});

describe("alerts accessibility", () => {
  test("has no axe violations in every state", async () => {
    const models = [
      fixtureAlerts,
      { ...fixtureAlerts, filter: "readiness" as const },
      { ...fixtureAlerts, alerts: [] },
      emptyAlerts,
      { ...fixtureAlerts, status: "loading" as const },
      { ...fixtureAlerts, status: "error" as const },
    ];
    for (const model of models) {
      const { container, unmount } = render(<AlertsScreen model={model} />);
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });
});
