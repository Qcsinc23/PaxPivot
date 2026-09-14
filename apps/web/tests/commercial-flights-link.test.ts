/**
 * Pure tests for the Google Flights link builder and curated origin airports (TASK-053).
 * `buildGoogleFlightsSearchUrl` never fetches; it only formats already-known trip data into a
 * safely encoded URL. Card-level rendering is covered in `tests/commercial-handoff.test.tsx`.
 */
import { describe, expect, test } from "vitest";
import {
  buildGoogleFlightsQueryText,
  buildGoogleFlightsSearchUrl,
  GOOGLE_FLIGHTS_BASE_URL,
  GOOGLE_FLIGHTS_PLAIN_URL,
  isoDateOnly,
  type CommercialFlightsLinkInput,
} from "@/lib/presentation/commercial-flights-link";
import {
  CURATED_ORIGIN_AIRPORTS,
  originAirportsForTerminal,
} from "@/lib/presentation/terminal-origin-airports";

function input(
  overrides: Partial<CommercialFlightsLinkInput> = {},
): CommercialFlightsLinkInput {
  return {
    destinationText: "Paris",
    windowStartIso: "2026-10-01T06:00:00Z",
    windowEndIso: "2026-10-04T18:00:00Z",
    partySize: 2,
    originAirports: ["PHL", "TTN", "EWR"],
    ...overrides,
  };
}

/** Decodes the built URL's own `q` parameter, proving the encoding round-trips. */
function queryFromUrl(url: string): string {
  return new URL(url).searchParams.get("q") ?? "";
}

describe("isoDateOnly", () => {
  test("extracts YYYY-MM-DD regardless of time-of-day or milliseconds", () => {
    expect(isoDateOnly("2026-10-01T06:00:00Z")).toBe("2026-10-01");
    expect(isoDateOnly("2026-01-05T23:59:59.999Z")).toBe("2026-01-05");
  });
});

describe("buildGoogleFlightsQueryText", () => {
  test("includes destination, origin airports, dates and party size", () => {
    expect(buildGoogleFlightsQueryText(input())).toBe(
      "Flights to Paris from PHL, TTN, EWR on 2026-10-01 through 2026-10-04 for 2 travelers",
    );
  });

  test("uses singular wording for one traveler", () => {
    expect(buildGoogleFlightsQueryText(input({ partySize: 1 }))).toContain(
      "for 1 traveler",
    );
    expect(buildGoogleFlightsQueryText(input({ partySize: 1 }))).not.toContain(
      "1 travelers",
    );
  });

  test("an unknown terminal (no curated airports) gets no origin — no 'from' clause", () => {
    const text = buildGoogleFlightsQueryText(input({ originAirports: [] }));
    expect(text).toBe(
      "Flights to Paris on 2026-10-01 through 2026-10-04 for 2 travelers",
    );
    expect(text).not.toContain(" from ");
  });
});

describe("buildGoogleFlightsSearchUrl", () => {
  test("targets the Google Flights base URL", () => {
    const url = buildGoogleFlightsSearchUrl(input());
    expect(url.startsWith(GOOGLE_FLIGHTS_BASE_URL)).toBe(true);
  });

  test("round-trips the exact query text through the URL's own q parameter", () => {
    const url = buildGoogleFlightsSearchUrl(input());
    expect(queryFromUrl(url)).toBe(buildGoogleFlightsQueryText(input()));
  });

  test("safely encodes special characters and ampersands in the destination", () => {
    const destination = 'Fiji & Samoa / "the islands"?';
    const url = buildGoogleFlightsSearchUrl(
      input({ destinationText: destination }),
    );
    // A raw "&" or "?" from the destination never creates a second query parameter or breaks
    // the URL structure — there is exactly one parameter, "q".
    expect(Array.from(new URL(url).searchParams.keys())).toEqual(["q"]);
    // ...and decoding that one parameter recovers the destination exactly.
    expect(queryFromUrl(url)).toContain(destination);
  });

  test("safely encodes unicode in the destination", () => {
    const destination = "São Paulo — Malé";
    const url = buildGoogleFlightsSearchUrl(
      input({ destinationText: destination }),
    );
    expect(queryFromUrl(url)).toContain(destination);
  });
});

describe("GOOGLE_FLIGHTS_PLAIN_URL", () => {
  test("is the bare Google Flights URL with no query", () => {
    expect(GOOGLE_FLIGHTS_PLAIN_URL).toBe(GOOGLE_FLIGHTS_BASE_URL);
    expect(new URL(GOOGLE_FLIGHTS_PLAIN_URL).searchParams.has("q")).toBe(false);
  });
});

describe("originAirportsForTerminal", () => {
  test("matches the four seeded terminals exactly", () => {
    expect(
      originAirportsForTerminal(
        "Joint Base McGuire-Dix-Lakehurst Passenger Terminal",
      ),
    ).toEqual(["PHL", "TTN", "EWR"]);
    expect(originAirportsForTerminal("Dover AFB Passenger Terminal")).toEqual([
      "PHL",
      "BWI",
    ]);
    expect(originAirportsForTerminal("BWI AMC Passenger Terminal")).toEqual([
      "BWI",
    ]);
    expect(
      originAirportsForTerminal("Joint Base Andrews Passenger Terminal"),
    ).toEqual(["DCA", "IAD", "BWI"]);
  });

  test("an unrecognized terminal name gets no origin airports", () => {
    expect(originAirportsForTerminal("Some Future Terminal")).toEqual([]);
    expect(originAirportsForTerminal("")).toEqual([]);
  });

  test("the curated table has exactly the four documented entries", () => {
    expect(Object.keys(CURATED_ORIGIN_AIRPORTS).sort()).toEqual(
      [
        "BWI AMC Passenger Terminal",
        "Dover AFB Passenger Terminal",
        "Joint Base Andrews Passenger Terminal",
        "Joint Base McGuire-Dix-Lakehurst Passenger Terminal",
      ].sort(),
    );
  });
});
