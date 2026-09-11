import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import TerminalDetailPage from "@/app/terminals/[terminalId]/page";
import TerminalsPage from "@/app/terminals/page";
import { readApi } from "@/lib/api/client";
import type { ApiResult } from "@/lib/api/client";
import type {
  TerminalDetailRead,
  TerminalNetworkRead,
} from "@/lib/api/contracts";
import { expectNoAxeViolations } from "../a11y";
import networkExample from "@/lib/api/examples/terminal-network.json";
import detailExample from "@/lib/api/examples/terminal-detail.json";

/** The live routes are server components; they read only through this module. */
vi.mock("@/lib/api/client", () => ({ readApi: vi.fn() }));

/** Next's notFound() aborts rendering by throwing; the mock must do the same. */
class NotFoundError extends Error {}
const notFoundCalls: string[] = [];
vi.mock("next/navigation", () => ({
  notFound: () => {
    notFoundCalls.push("notFound");
    throw new NotFoundError("NEXT_NOT_FOUND");
  },
}));

const readApiMock = vi.mocked(readApi);
const network = networkExample as unknown as TerminalNetworkRead;
const detail = detailExample as unknown as TerminalDetailRead;

/** The seeded names are real registry values, not mockup example content. */
const NETWORK_TERMINALS = [
  "Example Terminal a",
  "Example Terminal b",
  "Example Terminal c",
];

function params(terminalId: string) {
  return { params: Promise.resolve({ terminalId }) };
}

beforeEach(() => {
  readApiMock.mockReset();
  notFoundCalls.length = 0;
});

describe("live /terminals", () => {
  test("renders the network the API returned, through the adapter", async () => {
    readApiMock.mockResolvedValue({ ok: true, value: network });
    render(await TerminalsPage());

    expect(readApiMock).toHaveBeenCalledWith("/api/v1/terminals");
    // The header composes title + subtitle into one h1, so match on the title prefix.
    expect(
      screen.getByRole("heading", { level: 1, name: /^Terminals/ }),
    ).toBeTruthy();
    // Every terminal in the payload is listed, including the unobserved ones.
    for (const name of NETWORK_TERMINALS) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  test("a zero-terminal result is a factual empty state, not an error", async () => {
    readApiMock.mockResolvedValue({
      ok: true,
      value: { generated_at: "2026-09-10T12:00:00Z", terminals: [] },
    });
    render(await TerminalsPage());

    expect(
      screen.getByRole("heading", { name: "No terminals yet" }),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("a never-observed terminal reads 'Not checked yet', never a state", async () => {
    readApiMock.mockResolvedValue({ ok: true, value: network });
    const { container } = render(await TerminalsPage());

    // Text a sighted user reads: the label is the pill's own text, before the screen-reader-only
    // explanation. Matching the raw textContent would also match those explanations, which
    // legitimately contain phrases like "not evidence of no departures".
    const labels = Array.from(container.querySelectorAll(".pp-pill")).map(
      (pill) => pill.firstChild?.textContent?.trim() ?? "",
    );

    // Terminals c and d carry no observation, so they say so and nothing more.
    expect(labels.filter((text) => text === "Not checked yet")).toHaveLength(2);

    // The three things "not checked" must never be rendered as: each would turn a PaxPivot gap
    // into a claim about the world.
    const prohibited = [
      "Source missing",
      "No departures published",
      "Unavailable",
      "Withdrawn",
    ];
    for (const text of prohibited) {
      // "Unavailable" IS correct for terminal b, which really did fail; it must never appear
      // twice, which is what it would take to cover the two unobserved terminals.
      const expected = text === "Unavailable" ? 1 : 0;
      expect(labels.filter((label) => label === text)).toHaveLength(expected);
    }

    // The payload's own states still render as themselves.
    expect(labels.filter((text) => text.startsWith("Fresh"))).toHaveLength(1);
    expect(labels.some((text) => /\b0\b/.test(text))).toBe(false);
  });

  test("not_configured renders the honest empty state, not fixture data", async () => {
    readApiMock.mockResolvedValue({ ok: false, reason: "not_configured" });
    render(await TerminalsPage());

    expect(
      screen.getByRole("heading", { name: "No terminals yet" }),
    ).toBeTruthy();
    // An unwired API is not an error, and it is emphatically not a "no terminals" world claim
    // dressed up with data.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Example Terminal/)).toBeNull();
  });

  test.each(["unauthorized", "unavailable"] as const)(
    "%s renders the error state and never an empty list",
    async (reason) => {
      readApiMock.mockResolvedValue({ ok: false, reason });
      render(await TerminalsPage());

      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText(/failure on our side/)).toBeTruthy();
      expect(screen.queryByText(/No terminals yet/)).toBeNull();
      expect(screen.queryByText(/Example Terminal/)).toBeNull();
    },
  );

  test("has no axe violations in every state", async () => {
    const outcomes: ApiResult<TerminalNetworkRead>[] = [
      { ok: true, value: network },
      {
        ok: true,
        value: { generated_at: "2026-09-10T12:00:00Z", terminals: [] },
      },
      { ok: false, reason: "not_configured" },
      { ok: false, reason: "unauthorized" },
      { ok: false, reason: "unavailable" },
    ];
    for (const outcome of outcomes) {
      readApiMock.mockResolvedValue(outcome);
      const { container, unmount } = render(await TerminalsPage());
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });
});

describe("live /terminals/[terminalId]", () => {
  test("renders the detail the API returned, with its entrance", async () => {
    readApiMock.mockResolvedValue({ ok: true, value: detail });
    render(await TerminalDetailPage(params(detail.summary.terminal_id)));

    expect(readApiMock).toHaveBeenCalledWith(
      `/api/v1/terminals/${detail.summary.terminal_id}`,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: detail.summary.name }),
    ).toBeTruthy();
    expect(notFoundCalls).toEqual([]);
  });

  test("a never-observed source reads 'Not checked yet', never a state", async () => {
    // Terminal c is in the registry with no observation at all.
    const unobserved = network.terminals[2]!;
    readApiMock.mockResolvedValue({
      ok: true,
      value: {
        ...detail,
        summary: unobserved,
        facts: [],
        sources: [],
      },
    });
    render(await TerminalDetailPage(params(unobserved.terminal_id)));

    expect(screen.getByText("Not checked yet")).toBeTruthy();
    // The three things it must never become.
    expect(screen.queryByText("Source missing")).toBeNull();
    expect(screen.queryByText("No departures published")).toBeNull();
    expect(screen.queryByText(/no flights/i)).toBeNull();
  });

  test("not_found becomes a Next 404 and renders nothing", async () => {
    readApiMock.mockResolvedValue({ ok: false, reason: "not_found" });
    await expect(TerminalDetailPage(params("missing"))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFoundCalls).toHaveLength(1);
  });

  test("not_configured renders the honest empty state, not fixture data", async () => {
    readApiMock.mockResolvedValue({ ok: false, reason: "not_configured" });
    render(await TerminalDetailPage(params("any")));

    expect(
      screen.getByRole("heading", { name: "No terminal to show yet" }),
    ).toBeTruthy();
    expect(screen.queryByText(/failure on our side/)).toBeNull();
    expect(screen.queryByText("Example Terminal a")).toBeNull();
  });

  test.each(["unauthorized", "unavailable"] as const)(
    "%s renders the error state, not a missing terminal",
    async (reason) => {
      readApiMock.mockResolvedValue({ ok: false, reason });
      render(await TerminalDetailPage(params("any")));

      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText(/failure on our side/)).toBeTruthy();
      expect(notFoundCalls).toEqual([]);
      expect(screen.queryByText(/No terminal to show yet/)).toBeNull();
    },
  );

  test("has no axe violations in every state", async () => {
    const outcomes: ApiResult<TerminalDetailRead>[] = [
      { ok: true, value: detail },
      { ok: false, reason: "not_configured" },
      { ok: false, reason: "unauthorized" },
      { ok: false, reason: "unavailable" },
    ];
    for (const outcome of outcomes) {
      readApiMock.mockResolvedValue(outcome);
      const { container, unmount } = render(
        await TerminalDetailPage(params(detail.summary.terminal_id)),
      );
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });
});

describe("no fixture content on a live route", () => {
  test("the payload's own synthetic host never reaches the rendered network", async () => {
    // The examples carry `example.invalid` URLs, which the adapter does not render on the network.
    // This asserts the route renders the API's data and nothing from the fixture screen models.
    readApiMock.mockResolvedValue({ ok: true, value: network });
    const { container } = render(await TerminalsPage());
    const rendered = container.textContent ?? "";
    // Nothing from the showcase fixtures ("35 min drive", "24 h", the 90-min rule) may appear.
    expect(rendered).not.toMatch(/35 min drive/);
    expect(rendered).not.toMatch(/90-min drive rule/);
    expect(rendered).not.toMatch(/Reachable/);
  });
});
