import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { factText, known, unknown } from "@/lib/presentation/fact";
import {
  SOURCE_STATE_CODES,
  SOURCE_STATE_LEXICON,
  isSourceStateCode,
} from "@/lib/presentation/source-state";
import {
  ELIGIBILITY_WORDING,
  eligibilitySummaryText,
} from "@/lib/presentation/eligibility";
import {
  ASK_GROUNDING_NOUNS,
  ASK_VERDICT_WORDING,
  askGroundingText,
} from "@/lib/presentation/ask";
import {
  fixtureAskAnswer,
  fixtureAskAnswerUnknown,
} from "@/lib/presentation/fixtures";
import type { CompareRowView as ScreenCompareRowView } from "@/lib/presentation/screens/compare";
import {
  SORT_MODE_LABELS,
  SORT_OPTIONS,
  type AskAnswerView,
  type AskGroundingKind,
  type AskVerdictKind,
  type CompareRowView,
} from "@/lib/presentation/types";

describe("Fact", () => {
  test("unknown never formats as a number", () => {
    expect(factText(unknown("not published"), (n: number) => `$${n}`)).toBe(
      "Unknown",
    );
    expect(factText(known(0), (n) => `$${n}`)).toBe("$0");
    expect(factText(unknown())).not.toMatch(/0|none|no /i);
  });
});

describe("source-state lexicon", () => {
  test("covers exactly the thirteen authoritative states", () => {
    expect(SOURCE_STATE_CODES).toHaveLength(13);
    expect(Object.keys(SOURCE_STATE_LEXICON).sort()).toEqual(
      [...SOURCE_STATE_CODES].sort(),
    );
  });

  test("no label or wording reads as an absence of flights", () => {
    for (const lexeme of Object.values(SOURCE_STATE_LEXICON)) {
      expect(`${lexeme.label} ${lexeme.srText}`).not.toMatch(
        /no flights|none scheduled|nothing flying/i,
      );
    }
    expect(SOURCE_STATE_LEXICON.source_unreachable.srText).toMatch(
      /not evidence/,
    );
    expect(SOURCE_STATE_LEXICON.no_departures_published.srText).toMatch(
      /this source/,
    );
  });

  test("mirrors apps/api/paxpivot/domain/source.py::SourceState exactly", () => {
    const source = readFileSync(
      join(process.cwd(), "../api/paxpivot/domain/source.py"),
      "utf8",
    );
    const body = source.slice(
      source.indexOf("class SourceState("),
      source.indexOf("class SourceIdentity("),
    );
    const python = [...body.matchAll(/= "([a-z_]+)"/g)].map(
      (match) => match[1],
    );
    expect(python.length).toBe(13);
    expect([...SOURCE_STATE_CODES].sort()).toEqual([...python].sort());
  });

  test("only real codes are accepted", () => {
    expect(isSourceStateCode("fresh")).toBe(true);
    expect(isSourceStateCode("no_flights")).toBe(false);
    expect(isSourceStateCode("confirmed")).toBe(false);
  });
});

test("default ranking is labelled Recommended", () => {
  expect(SORT_MODE_LABELS.recommended).toBe("Recommended");
  expect(Object.values(SORT_MODE_LABELS)).not.toContain("Least risk");
});

test("SORT_OPTIONS is the one presentation-level list of sort choices", () => {
  expect(SORT_OPTIONS.map((option) => option.value)).toEqual(
    Object.keys(SORT_MODE_LABELS),
  );
  expect(SORT_OPTIONS[0]).toEqual({
    value: "recommended",
    label: "Recommended",
  });
  for (const option of SORT_OPTIONS) {
    expect(option.label).toBe(SORT_MODE_LABELS[option.value]);
  }
});

describe("eligibility wording", () => {
  test("formats the application's state and count in traveler terms", () => {
    expect(
      eligibilitySummaryText({ state: "eligible", travelerCount: 2 }),
    ).toBe("Eligible · 2 travelers");
    expect(
      eligibilitySummaryText({ state: "ineligible", travelerCount: 1 }),
    ).toBe("Not eligible · 1 traveler");
    expect(eligibilitySummaryText({ state: "unknown", travelerCount: 3 })).toBe(
      "Eligibility unknown · 3 travelers",
    );
    expect(
      eligibilitySummaryText({
        state: "outside_supported_scope",
        travelerCount: 2,
      }),
    ).toBe("Outside supported scope · 2 travelers");
  });

  test("never uses category codes or a verified tone for an undecided state", () => {
    for (const [state, wording] of Object.entries(ELIGIBILITY_WORDING)) {
      expect(`${wording.text} ${wording.srText}`).not.toMatch(/Cat(egory)? /);
      if (state !== "eligible") expect(wording.tone).not.toBe("verified");
    }
    expect(ELIGIBILITY_WORDING.unknown.tone).toBe("unknown");
    expect(ELIGIBILITY_WORDING.eligible.srText).toMatch(/not guaranteed/);
  });
});

describe("AskAnswerView contract", () => {
  test("unknown is an explicit verdict kind and renders the word Unknown verbatim", () => {
    const kinds: AskVerdictKind[] = [
      "recommendation",
      "unknown",
      "clarification",
    ];
    expect(Object.keys(ASK_VERDICT_WORDING).sort()).toEqual([...kinds].sort());
    expect(ASK_VERDICT_WORDING.unknown.label).toBe("Unknown");
    expect(ASK_VERDICT_WORDING.unknown.tone).toBe("unknown");
    expect(fixtureAskAnswerUnknown.verdict.kind).toBe("unknown");
    // The title alone may not mention unknown; the kind is what carries it.
    expect(
      ASK_VERDICT_WORDING[fixtureAskAnswerUnknown.verdict.kind].label,
    ).toBe("Unknown");
  });

  test("grounding is counted provenance, never a citation composed here", () => {
    const kinds: AskGroundingKind[] = [
      "route_search",
      "source_record",
      "policy",
      "history",
    ];
    expect(Object.keys(ASK_GROUNDING_NOUNS).sort()).toEqual([...kinds].sort());
    expect(askGroundingText(fixtureAskAnswer.grounding)).toBe(
      "Based on 1 route search · 2 source records",
    );
    expect(askGroundingText([])).toBe("Based on no structured records");
    expect(askGroundingText([{ kind: "policy", count: 0 }])).toBe(
      "Based on 0 policy citations",
    );
    for (const item of fixtureAskAnswer.grounding) {
      expect(Number.isInteger(item.count)).toBe(true);
    }
  });

  test("the comparison reuses the Compare screen's row contract", () => {
    // Type-level: the screen re-exports the foundation type, so both names are one type.
    const row: CompareRowView = fixtureAskAnswer.comparison!.rows[0]!;
    const same: ScreenCompareRowView = row;
    expect(same.cells).toHaveLength(
      fixtureAskAnswer.comparison!.options.length,
    );
    for (const cell of row.cells) {
      expect(["better", "tie", "none"]).toContain(cell.emphasis);
    }
  });

  test("an answer carries only structured parts: no free text can add a fact", () => {
    const answer: AskAnswerView = fixtureAskAnswer;
    expect(Object.keys(answer).sort()).toEqual(
      [
        "question",
        "verdict",
        "comparison",
        "explanation",
        "actions",
        "grounding",
        "followUps",
      ].sort(),
    );
    for (const action of answer.actions) {
      expect(["primary", "secondary", "ghost"]).toContain(action.variant);
      expect(action.href.length).toBeGreaterThan(0);
    }
    expect(answer.explanation).not.toMatch(/guarantee|will fly|probab/i);
  });
});
