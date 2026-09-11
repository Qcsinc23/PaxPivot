/**
 * The presentation adapters consume the JSON examples generated from the Python read models
 * (tests/unit/test_api_v1.py keeps them current), so this suite is the web half of the API
 * contract. It renders the real screens from adapted data and checks the invariants the
 * adapters must uphold: unknown stays unknown, never-observed is never a state, no coordinates
 * are invented, and nothing reads as an absence of flights.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { SourceStateBadge } from "@/components/paxpivot/SourceStateBadge";
import { SourceHealthScreen } from "@/components/screens/advanced/SourceHealthScreen";
import { TerminalDetailScreen } from "@/components/screens/terminals/TerminalDetailScreen";
import { TerminalNetworkScreen } from "@/components/screens/terminals/TerminalNetworkScreen";
import sourceHealthExample from "@/lib/api/examples/source-health.json";
import terminalDetailExample from "@/lib/api/examples/terminal-detail.json";
import terminalNetworkExample from "@/lib/api/examples/terminal-network.json";
import type {
  SourceHealthRead,
  TerminalDetailRead,
  TerminalNetworkRead,
} from "@/lib/api/contracts";
import {
  formatAge,
  formatCadence,
  formatTimestamp,
  toEvidenceView,
} from "@/lib/presentation/adapters/format";
import {
  toNotices,
  toSourceHealthScreenModel,
} from "@/lib/presentation/adapters/source-health";
import {
  toTerminalDetailScreenModel,
  toTerminalNetworkScreenModel,
} from "@/lib/presentation/adapters/terminals";
import { expectNoAxeViolations } from "./a11y";

const NOW = new Date("2026-09-10T12:00:00Z");
const network = terminalNetworkExample as TerminalNetworkRead;
const detail = terminalDetailExample as TerminalDetailRead;
const health = sourceHealthExample as SourceHealthRead;

describe("format helpers", () => {
  test("format only; never a decision", () => {
    expect(formatTimestamp("2026-09-10T11:30:00Z")).toBe("2026-09-10 11:30Z");
    expect(formatAge("2026-09-10T11:51:00Z", NOW)).toBe("9m");
    expect(formatAge("2026-09-10T09:00:00Z", NOW)).toBe("3h");
    expect(formatAge("2026-09-07T12:00:00Z", NOW)).toBe("3d");
    expect(formatAge("2026-09-10T13:00:00Z", NOW)).toBe("0m"); // clock skew, not negative
    expect(formatCadence(30)).toBe("Every 30 min");
    expect(formatCadence(360)).toBe("Every 6 h");
  });

  test("an unrecognised state code passes through and renders Unknown state", () => {
    // Guards the presentation boundary: if the API ever reports a code this lexicon does not
    // know, the adapter must NOT substitute a real state (e.g. source_missing, which asserts
    // that an artifact could not be found). It passes the code through and the badge says
    // "Unknown state" — the TASK-006 rule "never a positive state".
    const read = {
      observation_id: "obs-drift",
      state: "some_future_state",
      observed_at: "2026-09-10T11:51:00Z",
      source_time: null,
      retrieval: "succeeded" as const,
      extraction: "not_attempted" as const,
      parser_version: null,
      explanation: "Synthetic explanation.",
    };

    const view = toEvidenceView(read, NOW);
    expect(view.state).toBe("some_future_state");

    render(<SourceStateBadge evidence={view} />);
    expect(screen.getByText(/Unknown state/)).toBeTruthy();
    for (const invented of [
      "Missing",
      "Unavailable",
      "Stale",
      "Fresh",
      "None published",
      "No match",
    ]) {
      expect(screen.queryByText(new RegExp(invented))).toBeNull();
    }
  });
});

describe("terminal network adapter", () => {
  const model = toTerminalNetworkScreenModel(network, { now: NOW });

  test("lists the registry as supported terminals with travel time unknown", () => {
    expect(model.status).toBe("ready");
    expect(model.filter).toBe("all");
    expect(model.summary.reachable.status).toBe("unknown");
    expect(model.terminals).toHaveLength(network.terminals.length);
    for (const terminal of model.terminals) {
      expect(terminal.accessText.status).toBe("unknown");
      expect(terminal.href).toBe(`/terminals/${terminal.id}`);
    }
  });

  test("only a verified entrance becomes a marker with coordinates", () => {
    const withEntrance = network.terminals.filter((t) => t.entrance !== null);
    const markers = model.map.markers;
    expect(markers).toHaveLength(network.terminals.length);
    expect(
      markers.filter((m) => m.coordinates.status === "known"),
    ).toHaveLength(withEntrance.length);
    const verified = model.terminals.filter(
      (t) => t.entrance.status === "verified",
    );
    expect(verified).toHaveLength(withEntrance.length);
    expect(verified[0]?.entrance.label).toEqual({
      status: "known",
      value: "Passenger terminal entrance",
    });
  });

  test("never-observed terminals carry no evidence and render Not checked yet", () => {
    const unobserved = network.terminals.filter((t) => t.latest === null);
    expect(unobserved.length).toBeGreaterThan(0);
    for (const t of unobserved) {
      expect(
        model.terminals.find((c) => c.id === t.terminal_id)?.evidence,
      ).toBeUndefined();
    }
    render(<TerminalNetworkScreen model={model} />);
    expect(screen.getAllByText("Not checked yet")).toHaveLength(
      unobserved.length,
    );
    expect(
      screen.getByRole("heading", { name: "Supported terminals" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("group", { name: "Terminals to show" }),
    ).toBeNull();
  });

  test("a failed check shows its failure state, never an absence", () => {
    const failed = network.terminals.find(
      (t) => t.latest?.retrieval === "failed",
    );
    expect(failed).toBeTruthy();
    render(<TerminalNetworkScreen model={model} />);
    const card = screen.getByRole("article", { name: failed!.name });
    expect(within(card).getByText(/^Unavailable/)).toBeTruthy();
    const text = (document.body.textContent ?? "").toLowerCase();
    for (const forbidden of [
      "no flights",
      "none scheduled",
      "nothing flying",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  test("has no axe violations", async () => {
    const { container } = render(<TerminalNetworkScreen model={model} />);
    await expectNoAxeViolations(container, ["region"]);
  });
});

describe("terminal detail adapter", () => {
  const model = toTerminalDetailScreenModel(detail, { now: NOW });

  test("exposes only decided facts and hides actions it cannot honour", () => {
    expect(model.status).toBe("ready");
    expect(model.actions.directionsHref).toContain("0.5,0.5");
    expect(model.actions.officialHref).toBe(detail.summary.official_url);
    expect(model.actions.watchHref).toBeUndefined();
    expect(model.compareHref).toBeUndefined();
    expect(model.opportunities).toEqual([]);
    const stats = Object.fromEntries(
      model.stats.map((s) => [s.label, s.value]),
    );
    expect(stats["Hours"]).toEqual({
      status: "known",
      value: "Synthetic hours: 06:00–22:00",
    });
    expect(stats["Parking"]?.status).toBe("unknown");
    expect(stats["Published opportunities"]?.status).toBe("unknown");
    expect(model.history.observed.status).toBe("unknown");
    expect(model.evidence.age?.sourceTime).toEqual({
      status: "known",
      value: { iso: "2026-09-10T11:00:00Z", text: "2026-09-10 11:00Z" },
    });
    expect(model.evidence.rows[0]?.href).toBe(detail.sources[0]?.url);
  });

  test("a terminal without an entrance has no directions and no invented location", () => {
    const withoutEntrance: TerminalDetailRead = {
      ...detail,
      summary: {
        ...detail.summary,
        entrance: null,
        entrance_kind: null,
        latest: null,
      },
      facts: [],
      sources: [],
    };
    const bare = toTerminalDetailScreenModel(withoutEntrance, { now: NOW });
    expect(bare.actions.directionsHref).toBeUndefined();
    expect(bare.map.markers[0]?.coordinates.status).toBe("unknown");
    expect(bare.terminal.evidence).toBeUndefined();
    expect(bare.evidence.age).toBeUndefined();
    render(<TerminalDetailScreen model={bare} />);
    expect(screen.queryByRole("link", { name: /Directions/ })).toBeNull();
    expect(
      screen.getByText(/verified passenger entrance, which is not on/),
    ).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });

  test("renders and has no axe violations", async () => {
    const { container } = render(<TerminalDetailScreen model={model} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      detail.summary.name,
    );
    expect(screen.getByRole("link", { name: /Directions/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Official page" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Watch" })).toBeNull();
    await expectNoAxeViolations(container, ["region"]);
  });
});

describe("source health adapter", () => {
  const model = toSourceHealthScreenModel(health, { now: NOW });

  test("keeps unknowns unknown and never invents a state for an unread source", () => {
    expect(model.status).toBe("ready");
    expect(model.rows).toHaveLength(health.rows.length);
    const unread = model.rows.filter((r) => r.evidence === undefined);
    expect(unread).toHaveLength(health.never_observed);
    for (const row of unread) {
      expect(row.readAt).toEqual({
        status: "unknown",
        note: "Not checked yet",
      });
      expect(row.pageTime.status).toBe("unknown");
    }
    const failed = model.rows.find(
      (r) => r.evidence?.state === "source_unreachable",
    );
    expect(failed?.readAt.status).toBe("known"); // We did read (and failed); that is a fact.
    expect(failed?.pageTime.status).toBe("unknown");
    expect(failed?.killSwitched).toBe(true);
    expect(model.summary.map((s) => [s.evidence.state, s.count])).toEqual([
      ["fresh", 1],
      ["source_unreachable", 1],
    ]);
  });

  test("maps review states one-to-one, including restricted", () => {
    const approvals = new Set(model.rows.map((r) => r.approval));
    expect(approvals).toEqual(
      new Set(["approved", "review", "paused", "restricted"]),
    );
    expect(toNotices(health.rows).map((n) => n.kind)).toEqual(["restricted"]);
  });

  test("renders the table with Not checked yet and the kill-switch mark", async () => {
    const { container } = render(<SourceHealthScreen model={model} />);
    expect(
      screen.getAllByText("Not checked yet").length,
    ).toBeGreaterThanOrEqual(health.never_observed);
    expect(screen.getByText("Stopped")).toBeTruthy();
    expect(screen.getByText("Restricted")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Needs attention" }),
    ).toBeTruthy();
    await expectNoAxeViolations(container, ["region"]);
  });
});

describe("terminal detail opportunity wording", () => {
  const base = detail.summary;

  test("a failed check is never worded as 'none are published'", () => {
    const failed = toTerminalDetailScreenModel(
      {
        ...detail,
        summary: {
          ...base,
          latest: {
            ...(base.latest as NonNullable<typeof base.latest>),
            retrieval: "failed",
            state: "source_unreachable",
          },
        },
      },
      { now: NOW },
    );
    expect(failed.opportunitiesNote).toBe(
      "The last check did not succeed, so nothing is known about departures here.",
    );
    expect(failed.opportunitiesNote).not.toContain(
      "no opportunities are published",
    );

    render(<TerminalDetailScreen model={failed} />);
    const text = (document.body.textContent ?? "").toLowerCase();
    for (const forbidden of [
      "no opportunities are published",
      "no flights",
      "none scheduled",
      "nothing flying",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  test("a never-checked terminal says so rather than claiming an absence", () => {
    const never = toTerminalDetailScreenModel(
      { ...detail, summary: { ...base, latest: null } },
      { now: NOW },
    );
    expect(never.opportunitiesNote).toBe(
      "PaxPivot has not checked a source for this terminal yet.",
    );
    expect(never.opportunitiesNote).not.toContain(
      "no opportunities are published",
    );
  });

  test("a genuinely empty published source may say none are published", () => {
    const empty = toTerminalDetailScreenModel(
      {
        ...detail,
        summary: {
          ...base,
          latest: {
            ...(base.latest as NonNullable<typeof base.latest>),
            state: "no_departures_published",
          },
        },
      },
      { now: NOW },
    );
    expect(empty.opportunitiesNote).toBe(
      "This source published no departures.",
    );
  });
});
