// @vitest-environment node
/**
 * Shared POST-handler hardening (TASK-046): same-origin enforcement beyond SameSite=Lax, and a
 * body-size ceiling applied before any handler calls `formData()`. Covers the helper directly;
 * `auth.test.ts` and `trips-new.test.ts` prove the same behaviour through the real handlers.
 */
import { describe, expect, test } from "vitest";
import { checkBodySize, checkSameOrigin } from "@/lib/http/request-guards";

function request(headers: Record<string, string>): Request {
  return new Request("https://pilot.invalid/auth/session", {
    method: "POST",
    headers,
  });
}

describe("checkSameOrigin", () => {
  test("rejects a cross-site Sec-Fetch-Site", () => {
    const result = checkSameOrigin(request({ "sec-fetch-site": "cross-site" }));
    expect(result?.response.status).toBe(403);
  });

  test("rejects same-site (not same-origin) too, since only same-origin/none are trusted", () => {
    const result = checkSameOrigin(request({ "sec-fetch-site": "same-site" }));
    expect(result?.response.status).toBe(403);
  });

  test("accepts Sec-Fetch-Site: same-origin", () => {
    expect(
      checkSameOrigin(request({ "sec-fetch-site": "same-origin" })),
    ).toBeNull();
  });

  test("accepts Sec-Fetch-Site: none (a user-typed/bookmarked navigation)", () => {
    expect(checkSameOrigin(request({ "sec-fetch-site": "none" }))).toBeNull();
  });

  test("checks Origin vs Host too when Sec-Fetch-Site is absent, rejecting a mismatch", () => {
    const result = checkSameOrigin(
      request({ origin: "https://evil.invalid", host: "pilot.invalid" }),
    );
    expect(result?.response.status).toBe(403);
  });

  test("checks Origin vs Host too when Sec-Fetch-Site is absent, accepting a match", () => {
    expect(
      checkSameOrigin(
        request({ origin: "https://pilot.invalid", host: "pilot.invalid" }),
      ),
    ).toBeNull();
  });

  test("host comparison ignores case", () => {
    expect(
      checkSameOrigin(
        request({ origin: "https://Pilot.Invalid", host: "pilot.invalid" }),
      ),
    ).toBeNull();
  });

  test("rejects an Origin header that fails to parse as a URL", () => {
    const result = checkSameOrigin(
      request({ origin: "not-a-url", host: "pilot.invalid" }),
    );
    expect(result?.response.status).toBe(403);
  });

  test("allows a request with neither header (documented non-browser-client exception)", () => {
    expect(checkSameOrigin(request({}))).toBeNull();
  });

  test("checks Sec-Fetch-Site and Origin independently, not as a fallback chain", () => {
    // No real browser sends this combination, but the two checks are independent: an
    // otherwise same-origin Sec-Fetch-Site does not excuse a forged, mismatched Origin.
    const result = checkSameOrigin(
      request({
        "sec-fetch-site": "same-origin",
        origin: "https://evil.invalid",
        host: "pilot.invalid",
      }),
    );
    expect(result?.response.status).toBe(403);
  });

  test("accepts a request where both headers are present and agree", () => {
    expect(
      checkSameOrigin(
        request({
          "sec-fetch-site": "same-origin",
          origin: "https://pilot.invalid",
          host: "pilot.invalid",
        }),
      ),
    ).toBeNull();
  });

  test("rejects a same-host Origin whose scheme doesn't match X-Forwarded-Proto", () => {
    const result = checkSameOrigin(
      request({
        origin: "http://pilot.invalid",
        host: "pilot.invalid",
        "x-forwarded-proto": "https",
      }),
    );
    expect(result?.response.status).toBe(403);
  });

  test("accepts an Origin whose scheme matches X-Forwarded-Proto", () => {
    expect(
      checkSameOrigin(
        request({
          origin: "https://pilot.invalid",
          host: "pilot.invalid",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBeNull();
  });

  test("falls back to the request URL's own protocol when X-Forwarded-Proto is absent", () => {
    // The `request()` helper below builds requests at https://pilot.invalid/..., so a
    // http:// Origin is a scheme mismatch even with a matching host and no forwarded header.
    const mismatched = checkSameOrigin(
      request({ origin: "http://pilot.invalid", host: "pilot.invalid" }),
    );
    expect(mismatched?.response.status).toBe(403);
    expect(
      checkSameOrigin(
        request({ origin: "https://pilot.invalid", host: "pilot.invalid" }),
      ),
    ).toBeNull();
  });

  test("uses only the first value of a multi-valued X-Forwarded-Proto", () => {
    expect(
      checkSameOrigin(
        request({
          origin: "https://pilot.invalid",
          host: "pilot.invalid",
          "x-forwarded-proto": "https,http",
        }),
      ),
    ).toBeNull();
    const mismatched = checkSameOrigin(
      request({
        origin: "http://pilot.invalid",
        host: "pilot.invalid",
        "x-forwarded-proto": "https,http",
      }),
    );
    expect(mismatched?.response.status).toBe(403);
  });
});

describe("checkBodySize", () => {
  test("rejects a missing Content-Length with 413", () => {
    const result = checkBodySize(request({}), 8192);
    expect(result?.response.status).toBe(413);
  });

  test("rejects a Content-Length over the limit with 413", () => {
    const result = checkBodySize(request({ "content-length": "8193" }), 8192);
    expect(result?.response.status).toBe(413);
  });

  test("rejects a non-numeric Content-Length with 413", () => {
    const result = checkBodySize(
      request({ "content-length": "not-a-number" }),
      8192,
    );
    expect(result?.response.status).toBe(413);
  });

  test("rejects a negative Content-Length with 413", () => {
    const result = checkBodySize(request({ "content-length": "-1" }), 8192);
    expect(result?.response.status).toBe(413);
  });

  test("accepts a Content-Length at exactly the limit", () => {
    expect(
      checkBodySize(request({ "content-length": "8192" }), 8192),
    ).toBeNull();
  });

  test("accepts a small, well-formed Content-Length", () => {
    expect(checkBodySize(request({ "content-length": "42" }), 8192)).toBeNull();
  });

  test("a maximal legitimate trip form (200-char destination, full fields) fits under 16 KiB", () => {
    const body = new URLSearchParams({
      origin_terminal_id: "b3b2b6f0-6c1a-4e6a-9c1a-3f7a9c1a3f7a",
      destination_text: "x".repeat(200),
      window_start: "2026-09-14T12:00",
      window_end: "2026-10-14T12:00",
      party_size: "9",
    }).toString();
    const bytes = new TextEncoder().encode(body).length;
    expect(
      checkBodySize(request({ "content-length": String(bytes) }), 16 * 1024),
    ).toBeNull();
  });
});
