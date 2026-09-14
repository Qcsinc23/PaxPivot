// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { POST as createTrip } from "@/app/trips/new/route";
import { writeApi } from "@/lib/api/client";

const ORIGIN = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";
const env = {
  PAXPIVOT_API_URL: "http://api.invalid",
  PAXPIVOT_API_TOKEN: "synthetic-token-with-at-least-32-characters",
};

describe("trip request route (TASK-034)", () => {
  test("writeApi posts JSON with the token and maps 422 to invalid", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({}), { status: 422 }),
    ) as unknown as typeof fetch;
    expect(
      await writeApi("/api/v1/trips", { party_size: 0 }, { fetchImpl, env }),
    ).toEqual({ ok: false, reason: "invalid" });
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [URL, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ party_size: 0 }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
  });

  test("the route redirects to the created trip, or back with an error", async () => {
    const form = new URLSearchParams({
      origin_terminal_id: ORIGIN,
      destination_text: "  Somewhere warm ",
      window_start: "2026-10-01T06:00",
      window_end: "2026-10-04T06:00",
      party_size: "2",
    });
    const post = (body: URLSearchParams) =>
      createTrip(
        new Request("https://pilot.invalid/trips/new", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": String(
              new TextEncoder().encode(body.toString()).length,
            ),
          },
          body,
        }),
      );
    // Unconfigured API: nothing recorded, the traveler is told it is our failure.
    const missing = await post(form);
    expect(missing.status).toBe(303);
    expect(missing.headers.get("Location")).toBe("/?error=unavailable");
    // A malformed window never reaches the API.
    const bad = await post(
      new URLSearchParams({ ...Object.fromEntries(form), window_end: "soon" }),
    );
    expect(bad.headers.get("Location")).toBe("/?error=invalid");
  });

  test("a created trip redirects to its page; an API 422 goes back as invalid", async () => {
    process.env.PAXPIVOT_API_URL = "http://api.invalid";
    process.env.PAXPIVOT_API_TOKEN =
      "synthetic-token-with-at-least-32-characters";
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ trip_id: "6f1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7" }),
          {
            status: 201,
          },
        ),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 422 }));
    vi.stubGlobal("fetch", fetchImpl);
    try {
      const form = new URLSearchParams({
        origin_terminal_id: ORIGIN,
        destination_text: "Somewhere",
        window_start: "2026-10-01T06:00",
        window_end: "2026-10-04T06:00",
        party_size: "2",
      });
      const contentLength = (body: URLSearchParams) =>
        String(new TextEncoder().encode(body.toString()).length);
      const post = () =>
        createTrip(
          new Request("https://pilot.invalid/trips/new", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": contentLength(form),
            },
            body: form,
          }),
        );
      const created = await post();
      expect(created.status).toBe(303);
      expect(created.headers.get("Location")).toBe(
        "/trips/6f1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7",
      );
      const refused = await post();
      expect(refused.headers.get("Location")).toBe("/?error=invalid");
      // A date the engine would roll forward never reaches the API.
      const rolledBody = new URLSearchParams({
        ...Object.fromEntries(form),
        window_start: "2026-02-31T00:00",
      });
      const rolled = await createTrip(
        new Request("https://pilot.invalid/trips/new", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": contentLength(rolledBody),
          },
          body: rolledBody,
        }),
      );
      expect(rolled.headers.get("Location")).toBe("/?error=invalid");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
      delete process.env.PAXPIVOT_API_URL;
      delete process.env.PAXPIVOT_API_TOKEN;
    }
  });
});

describe("trip request route hardening (TASK-046)", () => {
  const maximalForm = new URLSearchParams({
    origin_terminal_id: ORIGIN,
    destination_text: "x".repeat(200),
    window_start: "2026-10-01T06:00",
    window_end: "2026-10-04T06:00",
    party_size: "9",
  });

  function request(
    body: URLSearchParams,
    headers: Record<string, string> = {},
  ): Request {
    const encoded = body.toString();
    return new Request("https://pilot.invalid/trips/new", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": String(new TextEncoder().encode(encoded).length),
        ...headers,
      },
      body: encoded,
    });
  }

  test("rejects a cross-site POST and a mismatched Origin", async () => {
    const crossSite = await createTrip(
      request(maximalForm, { "sec-fetch-site": "cross-site" }),
    );
    expect(crossSite.status).toBe(403);

    const mismatchedOrigin = await createTrip(
      request(maximalForm, {
        origin: "https://evil.invalid",
        host: "pilot.invalid",
      }),
    );
    expect(mismatchedOrigin.status).toBe(403);
  });

  test("accepts a same-origin POST (falls through to the unconfigured-API redirect)", async () => {
    const sameOrigin = await createTrip(
      request(maximalForm, { "sec-fetch-site": "same-origin" }),
    );
    // Not configured in this test's env, so the route still redirects — the point here is that
    // it was not rejected at 403/413 by the hardening checks.
    expect(sameOrigin.status).toBe(303);
    expect(sameOrigin.headers.get("Location")).toBe("/?error=unavailable");
  });

  test("rejects a body over the 16 KiB limit and one with no declared Content-Length", async () => {
    const oversize = await createTrip(
      request(maximalForm, { "content-length": String(17 * 1024) }),
    );
    expect(oversize.status).toBe(413);

    const encoded = maximalForm.toString();
    const noContentLength = await createTrip(
      new Request("https://pilot.invalid/trips/new", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encoded,
      }),
    );
    expect(noContentLength.status).toBe(413);
  });

  test("a maximal legitimate trip form (200-char destination, party of 9) is not rejected for size", async () => {
    const response = await createTrip(request(maximalForm));
    // Same as the same-origin test: this env has no API configured, so it redirects rather
    // than succeeding outright — the assertion is that size/origin hardening let it through.
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/?error=unavailable");
  });
});
