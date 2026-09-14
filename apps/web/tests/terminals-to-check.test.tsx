/**
 * Pure adapter tests for "terminals to check" (TASK-044). `toTerminalsToCheckViewModel` never
 * fetches; it takes an already-read network payload, trip and a map of already-read terminal
 * details and returns a view model. Page-level wiring (the actual `readApi` calls, forbidden
 * wording across the live route, axe on the live page) is covered in
 * `tests/screens/results.test.tsx`'s "live /trips/[tripId] route" describe block.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { TerminalsToCheck } from "@/app/trips/[tripId]/TerminalsToCheck";
import type { ApiResult } from "@/lib/api/client";
import type {
  SourceEvidenceRead,
  TerminalDetailRead,
  TerminalNetworkRead,
  TerminalSourceRead,
  TerminalSummaryRead,
  TripRead,
} from "@/lib/api/contracts";
import { toTerminalsToCheckViewModel } from "@/lib/presentation/adapters/terminals-to-check";
import { expectNoAxeViolations } from "./a11y";

const NOW = new Date("2026-09-14T12:00:00Z");

function evidence(
  overrides: Partial<SourceEvidenceRead> = {},
): SourceEvidenceRead {
  return {
    observation_id: "obs-1",
    state: "fresh",
    observed_at: "2026-09-14T11:30:00Z",
    source_time: "2026-09-14T11:00:00Z",
    retrieval: "succeeded",
    extraction: "exact_text",
    parser_version: "synthetic-parser-v1",
    explanation: "Synthetic explanation.",
    ...overrides,
  };
}

function summary(
  overrides: Partial<TerminalSummaryRead> &
    Pick<TerminalSummaryRead, "terminal_id">,
): TerminalSummaryRead {
  return {
    name: `Terminal ${overrides.terminal_id}`,
    installation: null,
    timezone: "UTC",
    operational_state: "verified",
    entrance: null,
    entrance_kind: null,
    official_url: `https://example.invalid/${overrides.terminal_id}`,
    latest: evidence(),
    ...overrides,
  };
}

function trip(originTerminalId: string): TripRead {
  return {
    trip_id: "trip-1",
    origin_terminal_id: originTerminalId,
    origin_terminal_name: "Origin",
    destination_text: "Somewhere",
    window_start: "2026-10-01T06:00:00Z",
    window_end: "2026-10-04T06:00:00Z",
    party_size: 2,
    created_at: "2026-09-11T12:00:00Z",
  };
}

function network(terminals: TerminalSummaryRead[]): TerminalNetworkRead {
  return { generated_at: NOW.toISOString(), terminals };
}

function scheduleSource(
  overrides: Partial<TerminalSourceRead> = {},
): TerminalSourceRead {
  return {
    source_id: "schedule-a",
    name: "Terminal A 72-hour schedule (AMC artifact)",
    url: "https://amc.example.mil/terminal-a/72hr-folder/",
    kind: "schedule_artifact",
    enabled: true,
    review_state: "restricted",
    latest: null,
    ...overrides,
  };
}

function detail(
  summaryRead: TerminalSummaryRead,
  sources: TerminalSourceRead[] = [scheduleSource()],
): TerminalDetailRead {
  return {
    generated_at: NOW.toISOString(),
    summary: summaryRead,
    entrance_instructions: null,
    facts: [],
    sources,
  };
}

function ok<T>(value: T): ApiResult<T> {
  return { ok: true, value };
}

function failed<T>(): ApiResult<T> {
  return { ok: false, reason: "unavailable" };
}

describe("toTerminalsToCheckViewModel", () => {
  test("orders the origin terminal first, then the rest by name, and states it is not a ranking", () => {
    const a = summary({ terminal_id: "a", name: "Zeta Terminal" });
    const b = summary({ terminal_id: "b", name: "Alpha Terminal" });
    const c = summary({ terminal_id: "c", name: "Mid Terminal" });
    const model = toTerminalsToCheckViewModel(
      trip("b"),
      network([a, b, c]),
      new Map([
        ["a", ok(detail(a))],
        ["b", ok(detail(b))],
        ["c", ok(detail(c))],
      ]),
      { now: NOW },
    );
    // Origin ("b", Alpha Terminal) first; the rest ("a" Zeta, "c" Mid) follow by name, so Mid
    // sorts before Zeta.
    expect(model.rows.map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(model.rows[0]?.isOrigin).toBe(true);
    expect(model.rows[1]?.isOrigin).toBe(false);
    expect(model.rows[2]?.isOrigin).toBe(false);
    expect(model.notARankingNote.toLowerCase()).toContain("not a ranking");
  });

  test("a never-checked terminal has no evidence and no age, never a fabricated state", () => {
    const a = summary({ terminal_id: "a", latest: null });
    const model = toTerminalsToCheckViewModel(
      trip("a"),
      network([a]),
      new Map([["a", ok(detail(a))]]),
      { now: NOW },
    );
    expect(model.rows[0]?.evidence).toBeUndefined();
    expect(model.rows[0]?.age).toBeUndefined();
  });

  test("a stale terminal keeps the effective state the API already derived", () => {
    const a = summary({
      terminal_id: "a",
      latest: evidence({ state: "source_stale" }),
    });
    const model = toTerminalsToCheckViewModel(
      trip("a"),
      network([a]),
      new Map([["a", ok(detail(a))]]),
      { now: NOW },
    );
    expect(model.rows[0]?.evidence?.state).toBe("source_stale");
  });

  test("an unreachable source keeps its own state, never an absence claim", () => {
    const a = summary({
      terminal_id: "a",
      latest: evidence({
        state: "source_unreachable",
        retrieval: "failed",
        extraction: "not_attempted",
        source_time: null,
      }),
    });
    const model = toTerminalsToCheckViewModel(
      trip("a"),
      network([a]),
      new Map([["a", ok(detail(a))]]),
      { now: NOW },
    );
    expect(model.rows[0]?.evidence?.state).toBe("source_unreachable");
  });

  test("a missing page time reads 'Page showed no timestamp', never a guessed time", () => {
    const a = summary({
      terminal_id: "a",
      latest: evidence({ source_time: null }),
    });
    const model = toTerminalsToCheckViewModel(
      trip("a"),
      network([a]),
      new Map([["a", ok(detail(a))]]),
      { now: NOW },
    );
    expect(model.rows[0]?.age?.sourceTime).toEqual({
      status: "unknown",
      note: "Page showed no timestamp",
    });
  });

  test("the registered 72-hour schedule link is labelled open-yourself and uses only the registered URL", () => {
    const a = summary({ terminal_id: "a" });
    const source = scheduleSource({
      url: "https://amc.example.mil/terminal-a/72hr-folder/",
    });
    const model = toTerminalsToCheckViewModel(
      trip("a"),
      network([a]),
      new Map([["a", ok(detail(a, [source]))]]),
      { now: NOW },
    );
    expect(model.rows[0]?.schedule).toEqual({
      status: "known",
      value: {
        href: "https://amc.example.mil/terminal-a/72hr-folder/",
        label: "72-hour schedule — open yourself",
      },
    });
  });

  test("a terminal whose detail read failed still appears; only its schedule link is unavailable", () => {
    const a = summary({ terminal_id: "a" });
    const b = summary({ terminal_id: "b", name: "Second Terminal" });
    const model = toTerminalsToCheckViewModel(
      trip("a"),
      network([a, b]),
      new Map([
        ["a", ok(detail(a))],
        ["b", failed<TerminalDetailRead>()],
      ]),
      { now: NOW },
    );
    const row = model.rows.find((r) => r.id === "b");
    expect(row).toBeTruthy();
    // The terminal itself is unaffected: its evidence still comes from the network read.
    expect(row?.evidence?.state).toBe("fresh");
    expect(row?.schedule.status).toBe("unknown");
  });

  test("a terminal whose detail read was never attempted also shows an unavailable schedule link", () => {
    const a = summary({ terminal_id: "a" });
    const model = toTerminalsToCheckViewModel(
      trip("a"),
      network([a]),
      new Map(),
      { now: NOW },
    );
    expect(model.rows[0]?.schedule.status).toBe("unknown");
  });

  test("every row's three not-yet-computed facts read Unknown, never zero or a guess", () => {
    const a = summary({ terminal_id: "a" });
    const model = toTerminalsToCheckViewModel(
      trip("a"),
      network([a]),
      new Map([["a", ok(detail(a))]]),
      { now: NOW },
    );
    const facts = model.rows[0]?.facts ?? [];
    expect(facts.map((f) => f.label)).toEqual([
      "Destinations served",
      "Entrance",
      "Drive time",
    ]);
    for (const fact of facts) {
      expect(fact.value.status).toBe("unknown");
    }
  });
});

describe("TerminalsToCheck component", () => {
  test("renders every terminal, the not-a-ranking copy and the schedule link", () => {
    const a = summary({ terminal_id: "a", name: "Origin Terminal" });
    const b = summary({
      terminal_id: "b",
      name: "Other Terminal",
      latest: null,
    });
    const model = toTerminalsToCheckViewModel(
      trip("a"),
      network([a, b]),
      new Map([
        ["a", ok(detail(a))],
        ["b", ok(detail(b, []))],
      ]),
      { now: NOW },
    );

    render(<TerminalsToCheck model={model} />);

    expect(
      screen.getByRole("heading", { name: "Terminals to check" }),
    ).toBeTruthy();
    expect(screen.getByText(/not a ranking/)).toBeTruthy();
    expect(
      screen.getByText("PaxPivot does not read departure schedules yet."),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Origin Terminal" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Other Terminal" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "72-hour schedule — open yourself" })
        .getAttribute("href"),
    ).toBe("https://amc.example.mil/terminal-a/72hr-folder/");
    // Terminal b registered no schedule source in this fixture: no link is invented for it.
    expect(
      screen.getByText(
        "No 72-hour schedule source is registered for this terminal.",
      ),
    ).toBeTruthy();
  });

  test("never claims flights, departures, seats, probability or a chance of anything, across every source state", () => {
    const fresh = summary({ terminal_id: "fresh", name: "Fresh Terminal" });
    const stale = summary({
      terminal_id: "stale",
      name: "Stale Terminal",
      latest: evidence({ state: "source_stale" }),
    });
    const unreachable = summary({
      terminal_id: "unreachable",
      name: "Unreachable Terminal",
      latest: evidence({
        state: "source_unreachable",
        retrieval: "failed",
        extraction: "not_attempted",
        source_time: null,
      }),
    });
    const neverChecked = summary({
      terminal_id: "never",
      name: "Never Checked Terminal",
      latest: null,
    });
    const model = toTerminalsToCheckViewModel(
      trip("fresh"),
      network([fresh, stale, unreachable, neverChecked]),
      new Map([
        ["fresh", ok(detail(fresh))],
        ["stale", ok(detail(stale))],
        ["unreachable", ok(detail(unreachable))],
        ["never", failed<TerminalDetailRead>()],
      ]),
      { now: NOW },
    );

    const { container } = render(<TerminalsToCheck model={model} />);
    let text = container.textContent ?? "";

    // Known, reviewed, legitimate occurrences: this page's own disclaimer, and the shared
    // SourceStateBadge accessibility text for "fresh" and "source_unreachable" (TASK-006
    // lexicon, unchanged by this task). Strip them before checking for a real violation.
    const KNOWN_SAFE = [
      "PaxPivot does not read departure schedules yet.",
      "not a reservation or a seat",
      "not evidence of no departures",
    ];
    for (const safe of KNOWN_SAFE) {
      expect(text).toContain(safe);
      text = text.replace(safe, "");
    }

    for (const banned of [/\bflights?\b/i, /\bdepartures?\b/i, /\bseats?\b/i]) {
      expect(text).not.toMatch(banned);
    }
    for (const phrase of ["no flights", "probability", "chance of"]) {
      expect(text.toLowerCase()).not.toContain(phrase);
    }
  });

  test("has no axe violations across every source state", async () => {
    const fresh = summary({ terminal_id: "fresh", name: "Fresh Terminal" });
    const stale = summary({
      terminal_id: "stale",
      name: "Stale Terminal",
      latest: evidence({ state: "source_stale" }),
    });
    const unreachable = summary({
      terminal_id: "unreachable",
      name: "Unreachable Terminal",
      latest: evidence({
        state: "source_unreachable",
        retrieval: "failed",
        extraction: "not_attempted",
        source_time: null,
      }),
    });
    const neverChecked = summary({
      terminal_id: "never",
      name: "Never Checked Terminal",
      latest: null,
    });
    const model = toTerminalsToCheckViewModel(
      trip("fresh"),
      network([fresh, stale, unreachable, neverChecked]),
      new Map([
        ["fresh", ok(detail(fresh))],
        ["stale", ok(detail(stale))],
        ["unreachable", ok(detail(unreachable))],
        ["never", failed<TerminalDetailRead>()],
      ]),
      { now: NOW },
    );

    const { container } = render(<TerminalsToCheck model={model} />);
    await expectNoAxeViolations(container, ["region"]);
  });
});
