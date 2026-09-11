import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "../app/page";
import { AppShell, GUARANTEE_TEXT } from "../components/shell/AppShell";

test("scaffold is honest about unavailable planning", () => {
  const { container } = render(
    <AppShell>
      <Home />
    </AppShell>,
  );
  expect(
    screen.getByText(/Journey planning is not available yet/),
  ).toBeTruthy();
  expect(screen.getByRole("contentinfo").textContent).toBe(GUARANTEE_TEXT);
  expect(container.querySelector("form")).toBeNull();
});
