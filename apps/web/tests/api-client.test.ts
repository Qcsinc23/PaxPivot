// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { readApi } from "@/lib/api/client";

const env = {
  PAXPIVOT_API_URL: "http://api.invalid",
  PAXPIVOT_API_TOKEN: "synthetic-token-with-at-least-32-characters",
};

function respond(status: number, body: unknown = {}): typeof fetch {
  return vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

describe("readApi", () => {
  test("sends the bearer token server-side and returns the payload", async () => {
    const fetchImpl = respond(200, { terminals: [] });
    const result = await readApi<{ terminals: unknown[] }>(
      "/api/v1/terminals",
      {
        fetchImpl,
        env,
      },
    );
    expect(result).toEqual({ ok: true, value: { terminals: [] } });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("http://api.invalid/api/v1/terminals");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      `Bearer ${env.PAXPIVOT_API_TOKEN}`,
    );
    expect(init.cache).toBe("no-store");
  });

  test("distinguishes not configured, unauthorized, not found and unavailable", async () => {
    expect(await readApi("/x", { fetchImpl: respond(200), env: {} })).toEqual({
      ok: false,
      reason: "not_configured",
    });
    expect(await readApi("/x", { fetchImpl: respond(401), env })).toEqual({
      ok: false,
      reason: "unauthorized",
    });
    expect(await readApi("/x", { fetchImpl: respond(404), env })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await readApi("/x", { fetchImpl: respond(500), env })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    const failing = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(await readApi("/x", { fetchImpl: failing, env })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});

test("refuses to run where a window exists (the token must stay server-side)", async () => {
  vi.stubGlobal("window", {});
  try {
    await expect(readApi("/x", { env })).rejects.toThrow(/server-only/);
  } finally {
    vi.unstubAllGlobals();
  }
});
