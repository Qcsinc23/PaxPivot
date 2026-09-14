// @vitest-environment node
/**
 * In-memory brute-force limiter for `POST /auth/session` (TASK-046; ADR-005 amendment
 * 2026-09-14, revised after review). Pure unit tests against an injectable clock, independent
 * of the HTTP layer; `auth.test.ts` proves the same limiter wired into the real route handler,
 * including that a global ceiling tripped by many distinct clients never blocks a fresh one's
 * correct passphrase.
 */
import { describe, expect, test, vi } from "vitest";
import {
  FAILURE_DELAY_MS,
  GLOBAL_THROTTLE_DELAY_MS,
  LoginRateLimiter,
  MAX_FAILURES_GLOBAL,
  MAX_FAILURES_PER_CLIENT,
  WINDOW_MS,
  clientKey,
  failureDelayMs,
} from "@/lib/auth/rate-limit";

function request(xff: string | undefined): Request {
  return new Request("https://pilot.invalid/auth/session", {
    method: "POST",
    headers: xff === undefined ? {} : { "x-forwarded-for": xff },
  });
}

describe("clientKey", () => {
  test("uses the right-most X-Forwarded-For entry — the one Traefik itself appended", () => {
    expect(clientKey(request("203.0.113.9"))).toBe("203.0.113.9");
    expect(clientKey(request("198.51.100.1, 203.0.113.9"))).toBe("203.0.113.9");
  });

  test("a forged prefix does not change the derived identity", () => {
    const spoofedA = clientKey(request("9.9.9.9, 203.0.113.9"));
    const spoofedB = clientKey(request("1.1.1.1, 8.8.8.8, 203.0.113.9"));
    expect(spoofedA).toBe("203.0.113.9");
    expect(spoofedB).toBe("203.0.113.9");
    expect(spoofedA).toBe(spoofedB);
  });

  test("falls back to a fixed key when Traefik added no header at all", () => {
    expect(clientKey(request(undefined))).toBe(clientKey(request(undefined)));
  });
});

describe("failureDelayMs", () => {
  test("chooses the longer delay only once the global ceiling is tripped", () => {
    expect(failureDelayMs(false)).toBe(FAILURE_DELAY_MS);
    expect(failureDelayMs(true)).toBe(GLOBAL_THROTTLE_DELAY_MS);
    expect(GLOBAL_THROTTLE_DELAY_MS).toBeGreaterThan(FAILURE_DELAY_MS);
  });
});

describe("LoginRateLimiter — per-client cap", () => {
  test("blocks the 11th failure from one client within the window, even with the right key later", () => {
    const limiter = new LoginRateLimiter();
    const now = 1_000_000;
    expect(MAX_FAILURES_PER_CLIENT).toBe(10);
    for (let i = 0; i < 10; i += 1) {
      expect(limiter.isClientBlocked("client-a", now)).toBe(false);
      limiter.recordFailure("client-a", now);
    }
    expect(limiter.isClientBlocked("client-a", now)).toBe(true);
  });

  test("a blocked client's window expires — an injectable clock proves it without a real wait", () => {
    const limiter = new LoginRateLimiter();
    const start = 1_000_000;
    for (let i = 0; i < 10; i += 1) limiter.recordFailure("client-a", start);
    expect(limiter.isClientBlocked("client-a", start)).toBe(true);
    expect(limiter.isClientBlocked("client-a", start + WINDOW_MS - 1)).toBe(
      true,
    );
    expect(limiter.isClientBlocked("client-a", start + WINDOW_MS + 1)).toBe(
      false,
    );
  });

  test("a client's own success clears its own failures, needing a fresh 10 to block again", () => {
    const limiter = new LoginRateLimiter({ maxFailuresPerClient: 3 });
    const now = 4_000_000;
    limiter.recordFailure("client-a", now);
    limiter.recordFailure("client-a", now);
    limiter.recordSuccess("client-a");
    limiter.recordFailure("client-a", now);
    limiter.recordFailure("client-a", now);
    expect(limiter.isClientBlocked("client-a", now)).toBe(false);
    limiter.recordFailure("client-a", now);
    expect(limiter.isClientBlocked("client-a", now)).toBe(true);
  });

  test("an XFF-spoofing attacker cannot reset their own per-client count by varying the forged prefix", () => {
    const limiter = new LoginRateLimiter();
    const now = 5_000_000;
    const real = "203.0.113.9";
    for (const prefix of [
      "1.1.1.1",
      "2.2.2.2",
      "3.3.3.3",
      "4.4.4.4",
      "5.5.5.5",
    ]) {
      const key = clientKey(request(`${prefix}, ${real}`));
      limiter.recordFailure(key, now);
    }
    for (let i = 5; i < 10; i += 1) limiter.recordFailure(real, now);
    const nextKey = clientKey(request(`7.7.7.7, ${real}`));
    expect(limiter.isClientBlocked(nextKey, now)).toBe(true);
  });

  test("bounds memory: the tracked-client map never exceeds its configured cap", () => {
    const limiter = new LoginRateLimiter({ maxTrackedClients: 50 });
    const now = 6_000_000;
    for (let i = 0; i < 500; i += 1) limiter.recordFailure(`client-${i}`, now);
    expect(limiter.trackedClients).toBeLessThanOrEqual(50);
  });

  test("expired entries are evicted, not merely ignored, once the window has passed", () => {
    const limiter = new LoginRateLimiter();
    const start = 7_000_000;
    limiter.recordFailure("client-a", start);
    expect(limiter.trackedClients).toBe(1);
    limiter.isClientBlocked("client-a", start + WINDOW_MS + 1);
    expect(limiter.trackedClients).toBe(0);
  });
});

describe("LoginRateLimiter — global ceiling (throttle, never a lockout)", () => {
  test("never blocks a brand-new client's own (unrecorded) attempt, even once the ceiling is tripped", () => {
    const limiter = new LoginRateLimiter({
      maxFailuresPerClient: 1000,
      maxFailuresGlobal: 5,
    });
    const now = 2_000_000;
    for (let i = 0; i < 5; i += 1) limiter.recordFailure(`client-${i}`, now);
    expect(limiter.isGlobalThrottled(now)).toBe(true);
    // The global ceiling has its own check (isGlobalThrottled); the per-client check for an
    // untouched client is unaffected by it.
    expect(limiter.isClientBlocked("brand-new-client", now)).toBe(false);
  });

  test("20 distinct clients failing 10 times each (the documented reachability) trips the ceiling", () => {
    const limiter = new LoginRateLimiter();
    const now = 3_000_000;
    expect(MAX_FAILURES_GLOBAL / MAX_FAILURES_PER_CLIENT).toBe(20);
    let globalThrottled = false;
    for (let i = 0; i < 20; i += 1) {
      for (let j = 0; j < MAX_FAILURES_PER_CLIENT; j += 1) {
        globalThrottled = limiter.recordFailure(`client-${i}`, now);
      }
    }
    expect(globalThrottled).toBe(true);
    // None of those 20 clients is blocked by this on a 21st, distinct, untouched client.
    expect(limiter.isClientBlocked("client-fresh", now)).toBe(false);
  });

  test("recordFailure fires onGlobalThrottleTripped exactly once per trip, not on every subsequent failure", () => {
    const trips: number[] = [];
    const limiter = new LoginRateLimiter({
      maxFailuresGlobal: 3,
      onGlobalThrottleTripped: () => trips.push(1),
    });
    const now = 8_000_000;
    limiter.recordFailure("a", now);
    limiter.recordFailure("b", now);
    expect(trips).toHaveLength(0);
    limiter.recordFailure("c", now); // crosses the ceiling
    expect(trips).toHaveLength(1);
    limiter.recordFailure("d", now); // still tripped — no additional event
    limiter.recordFailure("e", now);
    expect(trips).toHaveLength(1);
  });

  test("fires again after the window lets the count drop back below the ceiling and it re-trips", () => {
    const trips: number[] = [];
    const limiter = new LoginRateLimiter({
      windowMs: 1000,
      maxFailuresGlobal: 2,
      onGlobalThrottleTripped: () => trips.push(1),
    });
    limiter.recordFailure("a", 0);
    limiter.recordFailure("b", 0);
    expect(trips).toHaveLength(1);
    // Past the window: the two old failures expire, un-tripping the ceiling.
    expect(limiter.isGlobalThrottled(5000)).toBe(false);
    limiter.recordFailure("c", 5000);
    limiter.recordFailure("d", 5000);
    expect(trips).toHaveLength(2);
  });

  test("the default onGlobalThrottleTripped logs one structured event with no identifying detail", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const limiter = new LoginRateLimiter({ maxFailuresGlobal: 1 });
      limiter.recordFailure("some-client-ip", 9_000_000);
      expect(spy).toHaveBeenCalledTimes(1);
      const logged = spy.mock.calls[0]![0] as string;
      expect(logged).not.toContain("some-client-ip");
      const parsed = JSON.parse(logged) as Record<string, unknown>;
      expect(parsed).toEqual({ event: "auth_global_rate_limit_tripped" });
    } finally {
      spy.mockRestore();
    }
  });
});
