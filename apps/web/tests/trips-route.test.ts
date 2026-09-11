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
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
});
