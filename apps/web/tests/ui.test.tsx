import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Bell } from "lucide-react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { Button, IconButton } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/Pill";
import { Progress } from "@/components/ui/Progress";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { expectNoAxeViolations } from "./a11y";

describe("Button / IconButton", () => {
  test("icon-only buttons always carry an accessible name", () => {
    render(<IconButton label="Alerts" icon={<Bell aria-hidden="true" />} />);
    const button = screen.getByRole("button", { name: "Alerts" });
    expect(button.getAttribute("aria-label")).toBe("Alerts");
    expect(button.getAttribute("type")).toBe("button");
  });

  test("renders a link when given an href", () => {
    render(<Button href="/trips">Trips</Button>);
    expect(
      screen.getByRole("link", { name: "Trips" }).getAttribute("href"),
    ).toBe("/trips");
  });
});

describe("StatusPill", () => {
  test("carries meaning in text, with screen-reader detail", () => {
    render(
      <StatusPill tone="caution" srText="no recent successful read">
        Stale
      </StatusPill>,
    );
    expect(screen.getByText("Stale").textContent).toBe(
      "Stale, no recent successful read",
    );
  });
});

describe("Tabs", () => {
  const tabs = [
    { id: "a", label: "Overview", panel: <p>Panel A</p> },
    { id: "b", label: "Evidence", panel: <p>Panel B</p> },
    { id: "c", label: "History", panel: <p>Panel C</p> },
  ];

  test("moves selection and focus with arrow, Home and End keys", async () => {
    const user = userEvent.setup();
    render(<Tabs label="Sections" tabs={tabs} />);
    const [a, b, c] = screen.getAllByRole("tab");
    expect(a?.getAttribute("aria-selected")).toBe("true");
    expect(b?.getAttribute("tabindex")).toBe("-1");
    await user.tab();
    expect(document.activeElement).toBe(a);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(b);
    expect(b?.getAttribute("aria-selected")).toBe("true");
    expect(
      screen
        .getByText("Panel B")
        .closest("[role=tabpanel]")
        ?.hasAttribute("hidden"),
    ).toBe(false);
    expect(
      screen
        .getByText("Panel A")
        .closest("[role=tabpanel]")
        ?.hasAttribute("hidden"),
    ).toBe(true);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(c);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(a);
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(a);
  });

  test("has no axe violations", async () => {
    const { container } = render(<Tabs label="Sections" tabs={tabs} />);
    await expectNoAxeViolations(container, ["region"]);
  });
});

describe("SegmentedControl", () => {
  function Harness() {
    const [value, setValue] = useState<"recommended" | "fastest">(
      "recommended",
    );
    return (
      <>
        <SegmentedControl
          label="Sort routes"
          value={value}
          options={[
            { value: "recommended", label: "Recommended" },
            { value: "fastest", label: "Fastest" },
          ]}
          onChange={setValue}
        />
        <output>{value}</output>
      </>
    );
  }

  test("is a labelled radio group operable from the keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole("group", { name: "Sort routes" })).toBeTruthy();
    const recommended = screen.getByRole("radio", { name: "Recommended" });
    const fastest = screen.getByRole("radio", { name: "Fastest" });
    expect((recommended as HTMLInputElement).checked).toBe(true);
    await user.tab();
    expect(document.activeElement).toBe(recommended);
    await user.keyboard("{ArrowRight}");
    expect((fastest as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("fastest");
  });
});

describe("Sheet", () => {
  test("opens as a labelled modal dialog and closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Why this order">
        <p>Body</p>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Why this order" });
    expect(dialog.hasAttribute("open")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("state primitives", () => {
  test("empty, loading and error states are announced correctly", () => {
    render(
      <>
        <EmptyState
          title="Nothing planned yet"
          body="Tell us where you want to be."
        />
        <LoadingState title="Checking sources" />
        <ErrorState
          title="We could not check this source"
          body="Not evidence of no departures."
        />
      </>,
    );
    expect(
      screen.getByRole("heading", { name: "Nothing planned yet" }),
    ).toBeTruthy();
    const loading = screen.getByRole("status");
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(loading.textContent).toContain("Checking sources");
    expect(screen.getByRole("alert").textContent).toContain("could not check");
  });

  test("progress exposes its value", () => {
    render(<Progress label="Sources checked" value={4} max={7} />);
    const bar = screen.getByRole("progressbar", { name: "Sources checked" });
    expect(bar.getAttribute("aria-valuenow")).toBe("4");
    expect(bar.getAttribute("aria-valuemax")).toBe("7");
  });
});
