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

  /**
   * The floating Ask action is fixed over the page, above the bottom navigation, so the
   * scrollable content and the standing disclaimer each have to reserve room for the whole
   * control. Without that reserve the control is what ends up on top of the last row at the
   * bottom of the page.
   */
  test("the page reserves room for the floating Ask action", () => {
    const css = withoutComments(
      readFileSync(join(process.cwd(), "styles/components.css"), "utf8"),
    );
    const tokens = withoutComments(
      readFileSync(join(process.cwd(), "styles/tokens.css"), "utf8"),
    );

    // One token owns the control's height, so the reserve and the control cannot drift apart.
    expect(token(tokens, "--fab-height")).toBe(
      "calc(var(--hit) + var(--space-2))",
    );

    // The bottom inset of the scroll area must clear the navigation plus the whole control.
    const padding = rule(css, ".pp-main")
      .match(/padding:([^;]+);/)?.[1]
      ?.replace(/\s+/g, " ")
      .trim();
    expect(padding).toBeTruthy();
    for (const part of ["var(--nav-height)", "var(--fab-height)"]) {
      expect(padding).toContain(part);
    }
    expect(padding).toContain("env(safe-area-inset-bottom");

    // The standing disclaimer is last in the document, so it needs the same reserve.
    const footer = rule(css, ".pp-guarantee")
      .match(/margin-bottom:([^;]+);/)?.[1]
      ?.replace(/\s+/g, " ")
      .trim();
    expect(footer).toBeTruthy();
    for (const part of ["var(--nav-height)", "var(--fab-height)"]) {
      expect(footer).toContain(part);
    }

    // The control itself still has to be a comfortable touch target.
    expect(rule(css, ".pp-fab")).toContain("min-height: var(--hit)");

    // The desktop layout hides the bottom navigation but moves the control lower, and it
    // overrides both reserves; neither may drop below the control it is clearing.
    expect(
      desktopRule(css, ".pp-main").match(/padding:([^;]+);/)?.[1],
    ).toContain("var(--fab-height)");
    expect(
      desktopRule(css, ".pp-guarantee").match(/margin-bottom:([^;]+);/)?.[1],
    ).toContain("var(--fab-height)");

    // A sticky action bar hides the control (and sits in normal flow), so those pages reserve
    // the navigation only, on both layouts, instead of dead space for a control not shown.
    expect(rule(css, "body[data-sticky-bar] .pp-fab")).toContain(
      "display: none",
    );
    for (const find of [rule, desktopRule]) {
      const main = find(css, "body[data-sticky-bar] .pp-main");
      const footer = find(css, "body[data-sticky-bar] .pp-guarantee");
      expect(main).toContain("padding-bottom");
      expect(footer).toContain("margin-bottom");
      expect(main).not.toContain("--fab-height");
      expect(footer).not.toContain("--fab-height");
    }
  });
});

/** The bare declarations of the first rule whose selector list starts with `selector`. */
function rule(css: string, selector: string): string {
  const index = css.indexOf(`${selector} {`);
  if (index === -1) throw new Error(`no rule for ${selector}`);
  return css.slice(index, css.indexOf("}", index));
}

/** The same rule as overridden inside the first desktop media query. */
function desktopRule(css: string, selector: string): string {
  const desktop = css.slice(css.indexOf("@media (min-width: 60rem)"));
  return rule(desktop, selector);
}

function withoutComments(css: string): string {
  // Blank the comment out in place: comments are stripped but every other offset is unchanged,
  // so selectors can still be located by index.
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, " "),
  );
}

function token(css: string, name: string): string {
  const value = new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();
  if (value === undefined) throw new Error(`no token ${name}`);
  return value;
}
