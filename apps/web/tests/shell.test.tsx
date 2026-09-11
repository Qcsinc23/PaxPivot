import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import {
  MOBILE_NAV,
  RAIL_PRIMARY,
  RAIL_SECONDARY,
  isActive,
} from "@/lib/presentation/navigation";
import { expectNoAxeViolations } from "./a11y";

function renderShell(pathname: string) {
  globalThis.__paxpivotPathname = pathname;
  return render(
    <AppShell>
      <h1>Page</h1>
    </AppShell>,
  );
}

describe("navigation model", () => {
  test("mobile has exactly five destinations in the approved order and no Ask tab", () => {
    expect(MOBILE_NAV.map((d) => d.label)).toEqual([
      "Plan",
      "Trips",
      "Alerts",
      "Terminals",
      "Profile",
    ]);
    expect(
      MOBILE_NAV.some((d) => d.label.includes("Ask") || d.label === "Advanced"),
    ).toBe(false);
  });

  test("desktop rail keeps Profile and Advanced secondary", () => {
    expect(RAIL_PRIMARY.map((d) => d.label)).toEqual([
      "Plan",
      "Trips",
      "Terminals",
      "Alerts",
    ]);
    expect(RAIL_SECONDARY.map((d) => d.label)).toEqual(["Profile", "Advanced"]);
  });

  test("active matching is exact for Plan and prefix-based elsewhere", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/trips", "/")).toBe(false);
    expect(isActive("/trips/abc", "/trips")).toBe(true);
    expect(isActive("/tripsy", "/trips")).toBe(false);
  });
});

describe("AppShell", () => {
  test("marks the current destination in both navigations", () => {
    renderShell("/alerts/123");
    const primary = screen.getByRole("navigation", { name: "Primary" });
    const rail = screen.getByRole("navigation", { name: "Application" });
    expect(
      within(primary)
        .getByRole("link", { name: "Alerts" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(primary)
        .getByRole("link", { name: "Plan" })
        .getAttribute("aria-current"),
    ).toBeNull();
    expect(
      within(rail)
        .getByRole("link", { name: "Alerts" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(within(rail).getByRole("link", { name: "Advanced" })).toBeTruthy();
    expect(
      within(primary).queryByRole("link", { name: "Advanced" }),
    ).toBeNull();
  });

  test("exposes landmarks, a skip link and the floating Ask action", () => {
    renderShell("/");
    expect(screen.getByRole("main").id).toBe("main");
    expect(
      screen
        .getByRole("link", { name: "Skip to content" })
        .getAttribute("href"),
    ).toBe("#main");
    expect(
      screen.getByRole("link", { name: "Ask PaxPivot" }).getAttribute("href"),
    ).toBe("/ask");
    expect(screen.getByRole("contentinfo").textContent).toMatch(
      /not guaranteed/,
    );
  });

  test("hides the Ask action on the Ask screen itself", () => {
    renderShell("/ask");
    expect(screen.queryByRole("link", { name: "Ask PaxPivot" })).toBeNull();
  });

  test("shell has no axe violations", async () => {
    const { container } = renderShell("/");
    await expectNoAxeViolations(container);
  });

  test("stylesheet switches shells at the layout breakpoint and honours safe areas", () => {
    const css = readFileSync(
      join(process.cwd(), "styles/components.css"),
      "utf8",
    );
    const desktop = css.slice(css.indexOf("@media (min-width: 60rem)"));
    expect(desktop).toMatch(/\.pp-rail\s*\{[^}]*display:\s*flex/);
    expect(desktop).toMatch(/\.pp-bottom-nav\s*\{\s*display:\s*none/);
    expect(css).toMatch(/env\(safe-area-inset-bottom/);
    expect(css).toMatch(/env\(safe-area-inset-top/);
    expect(css).toMatch(/--hit:|min-height: var\(--hit\)/);
  });
});
