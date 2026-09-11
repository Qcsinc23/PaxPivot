import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import RouteError from "@/app/error";
import NotFound from "@/app/not-found";
import config, { SECURITY_HEADERS } from "@/next.config";
import { expectNoAxeViolations } from "./a11y";

describe("edge states", () => {
  test("the error boundary is a failure on our side and hides the error text", async () => {
    const reset = vi.fn();
    const { container } = render(
      <RouteError error={new Error("secret internal detail")} reset={reset} />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "failure in PaxPivot",
    );
    expect(container.textContent).not.toContain("secret internal detail");
    expect(container.textContent?.toLowerCase()).not.toMatch(
      /no flights|nothing flying/,
    );
    screen.getByRole("button", { name: "Try again" }).click();
    expect(reset).toHaveBeenCalledTimes(1);
    await expectNoAxeViolations(container, ["region"]);
  });

  test("not-found is about the address, with a way back", async () => {
    const { container } = render(<NotFound />);
    expect(
      screen.getByRole("heading", { name: "That page does not exist" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Go to Plan" }).getAttribute("href"),
    ).toBe("/");
    await expectNoAxeViolations(container, ["region"]);
  });

  test("every response carries the hardening headers", async () => {
    const rules = await config.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0]!.source).toBe("/(.*)");
    const keys = rules[0]!.headers.map((h) => h.key);
    for (const required of [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Strict-Transport-Security",
      "Content-Security-Policy",
      "Permissions-Policy",
    ]) {
      expect(keys).toContain(required);
    }
    expect(
      SECURITY_HEADERS.find((h) => h.key === "X-Frame-Options")?.value,
    ).toBe("DENY");
    expect(config.poweredByHeader).toBe(false);
    expect(config.output).toBe("standalone");
  });
});
