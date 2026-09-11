import axe from "axe-core";
import { expect } from "vitest";

/** Runs axe on a rendered container. Colour contrast needs real layout, so it is checked by review. */
export async function expectNoAxeViolations(
  container: Element,
  disable: string[] = [],
) {
  const rules = Object.fromEntries(
    ["color-contrast", ...disable].map((rule) => [rule, { enabled: false }]),
  );
  const results = await axe.run(container, { rules });
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`,
  );
  expect(summary).toEqual([]);
}
