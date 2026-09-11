import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { factText, known, unknown } from "@/lib/presentation/fact";
import {
  SOURCE_STATE_CODES,
  SOURCE_STATE_LEXICON,
  isSourceStateCode,
} from "@/lib/presentation/source-state";
import { SORT_MODE_LABELS } from "@/lib/presentation/types";

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
