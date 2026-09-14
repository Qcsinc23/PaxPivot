// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { POST as saveParty } from "@/app/profile/edit/route";

const SPONSOR_ID = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";

function post(fields: Record<string, string | string[]>): Request {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) form.append(key, v);
  }
  return new Request("https://pilot.invalid/profile/edit", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
}

describe("profile edit route (TASK-050)", () => {
  test("redirects back with an error when the API is not configured", async () => {
    const response = await saveParty(
      post({ sponsor_id: SPONSOR_ID, sponsor_category_attestation: "VI" }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/profile?error=unavailable");
  });

  test("PUTs the shaped body and redirects to /profile on success", async () => {
    process.env.PAXPIVOT_API_URL = "http://api.invalid";
    process.env.PAXPIVOT_API_TOKEN =
      "synthetic-token-with-at-least-32-characters";
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ status: "set", party: { travelers: [] } }),
          {
            status: 200,
          },
        ),
    );
    vi.stubGlobal("fetch", fetchImpl);
    try {
      const response = await saveParty(
        post({
          sponsor_id: SPONSOR_ID,
          sponsor_category_attestation: "VI",
          dependent_id: ["", "existing-dep-id"],
          dependent_category_attestation: ["unknown", "II"],
          dependent_age_band: ["under_14", "adult"],
        }),
      );
      expect(response.status).toBe(303);
      expect(response.headers.get("Location")).toBe("/profile");
      const [url, init] = fetchImpl.mock.calls[0] as unknown as [
        URL,
        RequestInit,
      ];
      expect(String(url)).toBe("http://api.invalid/api/v1/profile");
      expect(init.method).toBe("PUT");
      const body = JSON.parse(init.body as string);
      expect(body.travelers).toHaveLength(3);
      expect(body.travelers[0]).toMatchObject({
        traveler_id: SPONSOR_ID,
        role: "sponsor",
        category_attestation: "VI",
        age_band: "adult",
        sponsor_id: null,
      });
      // A blank dependent id is generated fresh; an existing one is preserved.
      expect(body.travelers[1].traveler_id).not.toBe("");
      expect(body.travelers[1].sponsor_id).toBe(SPONSOR_ID);
      expect(body.travelers[2].traveler_id).toBe("existing-dep-id");
      expect(body.travelers[2].category_attestation).toBe("II");
      expect(body.travelers[2].age_band).toBe("adult");
    } finally {
      vi.unstubAllGlobals();
      delete process.env.PAXPIVOT_API_URL;
      delete process.env.PAXPIVOT_API_TOKEN;
    }
  });

  test("a 422 from the API redirects back as an invalid-party error", async () => {
    process.env.PAXPIVOT_API_URL = "http://api.invalid";
    process.env.PAXPIVOT_API_TOKEN =
      "synthetic-token-with-at-least-32-characters";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 422 })),
    );
    try {
      const response = await saveParty(
        post({ sponsor_id: SPONSOR_ID, sponsor_category_attestation: "VI" }),
      );
      expect(response.status).toBe(303);
      expect(response.headers.get("Location")).toBe("/profile?error=invalid");
    } finally {
      vi.unstubAllGlobals();
      delete process.env.PAXPIVOT_API_URL;
      delete process.env.PAXPIVOT_API_TOKEN;
    }
  });

  test("an invented category or age band value is normalised to unknown, never rejected here", async () => {
    process.env.PAXPIVOT_API_URL = "http://api.invalid";
    process.env.PAXPIVOT_API_TOKEN =
      "synthetic-token-with-at-least-32-characters";
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ status: "set", party: { travelers: [] } }),
          {
            status: 200,
          },
        ),
    );
    vi.stubGlobal("fetch", fetchImpl);
    try {
      await saveParty(
        post({
          sponsor_id: SPONSOR_ID,
          sponsor_category_attestation: "not-a-real-category",
          dependent_id: [""],
          dependent_category_attestation: ["also-not-real"],
          dependent_age_band: ["also-not-real"],
        }),
      );
      const [, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.travelers[0].category_attestation).toBe("unknown");
      expect(body.travelers[1].category_attestation).toBe("unknown");
      expect(body.travelers[1].age_band).toBe("unknown");
    } finally {
      vi.unstubAllGlobals();
      delete process.env.PAXPIVOT_API_URL;
      delete process.env.PAXPIVOT_API_TOKEN;
    }
  });

  test("a malformed request body is a plain 400, not a 500", async () => {
    const bad = new Request("https://pilot.invalid/profile/edit", {
      method: "POST",
    });
    Object.defineProperty(bad, "formData", {
      value: () => {
        throw new Error("boom");
      },
    });
    const response = await saveParty(bad);
    expect(response.status).toBe(400);
  });
});
