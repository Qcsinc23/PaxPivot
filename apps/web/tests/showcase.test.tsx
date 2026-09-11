import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { Showcase } from "@/components/showcase/Showcase";
import { expectNoAxeViolations } from "./a11y";

const ROOT = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Example content from the approved mockups must never be baked into production code. */
const MOCKUP_LITERALS = [
  "Montclair",
  "McGuire",
  "Hickam",
  "Dover",
  "Waikiki",
  "Honolulu",
  "Alvarez",
  "Ramstein",
  "Westover",
  "$612",
  "$38",
  "Cat VI",
  "47m",
  "14m",
  "obs_88",
];

describe("showcase", () => {
  test("renders every foundation component from typed fixtures", () => {
    render(<Showcase />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "showcase",
    );
    expect(screen.getAllByText("Safest overall").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Best Space-A").length).toBeGreaterThan(0);
    expect(screen.getByRole("list", { name: "Journey" })).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "Locations on the map" }),
    ).toBeTruthy();
    expect(screen.getByRole("group", { name: "Sort routes" })).toBeTruthy();
  });

  test("has no axe violations", async () => {
    const { container } = render(<Showcase />);
    await expectNoAxeViolations(container, ["region"]);
  });

  test("production components and routes contain no mockup demo values", () => {
    const files = [
      ...walk(join(ROOT, "components")),
      ...walk(join(ROOT, "app")),
    ].filter(
      (file) => /\.(tsx|ts|css)$/.test(file) && !file.includes("/showcase/"),
    );
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return MOCKUP_LITERALS.filter((literal) => text.includes(literal)).map(
        (l) => `${file}: ${l}`,
      );
    });
    expect(offenders).toEqual([]);
  });
});
