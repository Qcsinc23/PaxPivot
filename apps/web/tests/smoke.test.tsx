import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import Home from "../app/page";
import { readApi } from "../lib/api/client";
import { AppShell, GUARANTEE_TEXT } from "../components/shell/AppShell";
import { fixturePlan } from "../lib/presentation/screens/plan";

vi.mock("../lib/api/client", () => ({ readApi: vi.fn() }));

/** Every string a synthetic fixture carries, so the live route can be proven free of them. */
function fixtureStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string" && value.length > 3) out.push(value);
  else if (Array.isArray(value))
    value.forEach((item) => fixtureStrings(item, out));
  else if (value && typeof value === "object")
    Object.values(value).forEach((item) => fixtureStrings(item, out));
  return out;
}

/**
 * Foundation invariant, independent of any screen's copy: the shell renders, the live Plan route
 * offers only a trip request form (no synthetic fixture text), and route search is not presented
 * as operational before an application contract feeds it.
 */
test("the shell and the live Plan route are honest before route search", async () => {
  vi.mocked(readApi).mockResolvedValue({
    ok: true,
    value: { generated_at: "2026-09-11T12:00:00Z", terminals: [] },
  });
  const { container } = render(
    <AppShell>{await Home({ searchParams: Promise.resolve({}) })}</AppShell>,
  );
  expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();

  expect(screen.getByRole("main")).toBeTruthy();
  expect(screen.getByRole("contentinfo").textContent).toBe(GUARANTEE_TEXT);
  expect(screen.getByRole("link", { name: "Ask PaxPivot" })).toBeTruthy();

  // With no registered terminal there is nothing to request from; no form is offered.
  expect(container.querySelector("form")).toBeNull();
  expect(screen.getByText("No terminals yet")).toBeTruthy();

  // Nothing is presented as a planned journey: no trip, route or terminal cards.
  expect(container.querySelector("article")).toBeNull();
  expect(screen.queryByRole("list", { name: "Watched trips" })).toBeNull();
  expect(
    screen.queryByText(/Best Space-A|Safest overall|Option \d/),
  ).toBeNull();

  // The live route never leaks the synthetic fixture.
  const text = container.textContent ?? "";
  for (const literal of fixtureStrings(fixturePlan)) {
    if (literal.startsWith("/")) continue; // hrefs are shared navigation, not data
    expect(text, literal).not.toContain(literal);
  }
});
