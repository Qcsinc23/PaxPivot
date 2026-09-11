import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import AdvancedPage from "@/app/advanced/page";
import { readApi } from "@/lib/api/client";
import type { ApiResult } from "@/lib/api/client";
import type { SourceHealthRead } from "@/lib/api/contracts";
import healthExample from "@/lib/api/examples/source-health.json";
import { expectNoAxeViolations } from "../a11y";

/** The live route is a server component; it reads only through this module. */
vi.mock("@/lib/api/client", () => ({ readApi: vi.fn() }));

const readApiMock = vi.mocked(readApi);
const health = healthExample as unknown as SourceHealthRead;

/** Visible text of a pill, before its screen-reader-only explanation. */
function pillLabels(scope: Element): string[] {
  return Array.from(scope.querySelectorAll(".pp-pill")).map(
    (pill) => pill.firstChild?.textContent?.trim() ?? "",
  );
}

/**
 * Pills of the per-source table rows only. The summary band above the table counts states across
 * sources, so it repeats labels the table also shows once per source; per-source claims must be
 * asserted against the table, not the whole page.
 */
function tableLabels(container: Element): string[] {
  const body = container.querySelector("table tbody");
  return body ? pillLabels(body) : [];
}

beforeEach(() => {
  readApiMock.mockReset();
});

describe("live /advanced", () => {
  test("renders the registry the API returned, through the adapter", async () => {
    readApiMock.mockResolvedValue({ ok: true, value: health });
    render(await AdvancedPage());

    expect(readApiMock).toHaveBeenCalledWith("/api/v1/sources/health");
    expect(
      screen.getByRole("heading", { level: 1, name: /^Source health/ }),
    ).toBeTruthy();
    for (const row of health.rows) {
      expect(screen.getAllByText(row.name).length).toBeGreaterThan(0);
    }
  });

  test("preserves the review states the application decided", async () => {
    readApiMock.mockResolvedValue({ ok: true, value: health });
    const { container } = render(await AdvancedPage());
    const labels = tableLabels(container);

    // The example carries one source of each review state; each must render as itself.
    expect(labels).toContain("Needs review");
    expect(labels).toContain("Restricted");
    expect(labels).toContain("Approved");
    expect(labels).toContain("Paused");
  });

  test("a kill-switched source reads 'Stopped', not a state change", async () => {
    readApiMock.mockResolvedValue({ ok: true, value: health });
    render(await AdvancedPage());

    // The example's kill-switched source still carries its real observation.
    expect(screen.getByText("Stopped")).toBeTruthy();
    // Stopping processing does not rewrite history into an absence.
    expect(screen.queryByText(/no flights/i)).toBeNull();
  });

  test("a never-observed source reads 'Not checked yet', never a state", async () => {
    readApiMock.mockResolvedValue({ ok: true, value: health });
    const { container } = render(await AdvancedPage());
    const labels = tableLabels(container);

    // The example has three sources with no observation at all.
    expect(labels.filter((text) => text === "Not checked yet")).toHaveLength(3);
    // Exactly one source genuinely failed (terminal-b), and it must be the only failure shown;
    // the two never-checked sources beside it must not borrow its state.
    expect(labels.filter((text) => text === "Unavailable")).toHaveLength(1);
    expect(labels).not.toContain("Source missing");
    expect(labels).not.toContain("No departures published");
    expect(labels).not.toContain("Withdrawn");
  });

  test("an unobserved source's times read 'Not checked yet', not a blank or a zero", async () => {
    readApiMock.mockResolvedValue({ ok: true, value: health });
    render(await AdvancedPage());

    // Page time and "we read it" for the never-checked sources say so explicitly.
    expect(
      screen.getAllByText("Not checked yet").length,
    ).toBeGreaterThanOrEqual(3);
  });

  test("a zero-source result is a factual empty state, not an error", async () => {
    readApiMock.mockResolvedValue({
      ok: true,
      value: {
        generated_at: "2026-09-10T12:00:00Z",
        rows: [],
        counts: [],
        never_observed: 0,
      },
    });
    render(await AdvancedPage());

    expect(screen.queryByRole("alert")).toBeNull();
    // The empty branch says there is nothing to show rather than claiming sources are healthy.
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("not_configured is a configuration error, never an empty registry", async () => {
    readApiMock.mockResolvedValue({ ok: false, reason: "not_configured" });
    const { container } = render(await AdvancedPage());
    expect(screen.getByRole("alert").textContent).toContain(
      "configuration problem, not evidence that no terminals or sources exist",
    );
    expect(
      screen.getByText("PaxPivot data is not available right now."),
    ).toBeTruthy();
    // No absence claim is made as a heading: those belong to a successful empty response only.
    expect(
      screen.queryByRole("heading", {
        name: /No terminals|No sources|No terminal to show|not being checked/i,
      }),
    ).toBeNull();
    expect(container.querySelector("article")).toBeNull();
    // Nothing operational leaks: no URL, token or variable name.
    expect(container.textContent).not.toMatch(/PAXPIVOT_|http|token/i);
  });

  test.each(["unauthorized", "unavailable"] as const)(
    "%s renders the error state, not an empty registry",
    async (reason) => {
      readApiMock.mockResolvedValue({ ok: false, reason });
      const { container } = render(await AdvancedPage());

      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText(/failure on our side/)).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
      expect(pillLabels(container)).toEqual([]);
      expect(container.textContent).not.toMatch(
        /Synthetic fixture explanation/,
      );
    },
  );

  test("reproduces no movement rows and offers no operator action", async () => {
    readApiMock.mockResolvedValue({ ok: true, value: health });
    const { container } = render(await AdvancedPage());
    const text = container.textContent ?? "";

    // This view is read-only: no control that could enable, approve or stop a source.
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.queryAllByRole("checkbox")).toEqual([]);
    expect(screen.queryAllByRole("switch")).toEqual([]);

    // And it carries no movement content.
    for (const forbidden of [
      /no flights/i,
      /none scheduled/i,
      /nothing flying/i,
      /departures? (?:are )?(?:listed|available)/i,
      /seats? available/i,
    ]) {
      expect(text).not.toMatch(forbidden);
    }
  });

  test("has no axe violations in every state", async () => {
    const outcomes: ApiResult<SourceHealthRead>[] = [
      { ok: true, value: health },
      {
        ok: true,
        value: {
          generated_at: "2026-09-10T12:00:00Z",
          rows: [],
          counts: [],
          never_observed: 0,
        },
      },
      { ok: false, reason: "not_configured" },
      { ok: false, reason: "unauthorized" },
      { ok: false, reason: "unavailable" },
    ];
    for (const outcome of outcomes) {
      readApiMock.mockResolvedValue(outcome);
      const { container, unmount } = render(await AdvancedPage());
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });
});
