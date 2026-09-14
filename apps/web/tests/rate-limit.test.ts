// @vitest-environment node
/**
 * In-memory brute-force limiter for `POST /auth/session` (TASK-046; ADR-005 amendment
 * 2026-09-14). Pure unit tests against an injectable clock, independent of the HTTP layer;
 * `auth.test.ts` proves the same limiter wired into the real route handler.
 */
import { describe, expect, test } from "vitest";
import {
  LoginRateLimiter,
  MAX_FAILURES_GLOBAL,
  MAX_FAILURES_PER_CLIENT,
  MAX_TRACKED_CLIENTS,
  WINDOW_MS,
  clientKey,
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

describe("LoginRateLimiter", () => {
  test("blocks the 11th failure from one client within the window", () => {
    const limiter = new LoginRateLimiter();
    const now = 1_000_000;
    expect(MAX_FAILURES_PER_CLIENT).toBe(10);
    for (let i = 0; i < 10; i += 1) {
      expect(limiter.isBlocked("client-a", now)).toBe(false);
      limiter.recordFailure("client-a", now);
    }
    // The 11th attempt is blocked before any further compare happens.
    expect(limiter.isBlocked("client-a", now)).toBe(true);
  });

  test("a blocked client's window expires — an injectable clock proves it without a real wait", () => {
    const limiter = new LoginRateLimiter();
    const start = 1_000_000;
    for (let i = 0; i < 10; i += 1) limiter.recordFailure("client-a", start);
    expect(limiter.isBlocked("client-a", start)).toBe(true);
    expect(limiter.isBlocked("client-a", start + WINDOW_MS - 1)).toBe(true);
    expect(limiter.isBlocked("client-a", start + WINDOW_MS + 1)).toBe(false);
  });

  test("a global failure ceiling blocks a brand-new client with zero failures of its own", () => {
    const limiter = new LoginRateLimiter(
      WINDOW_MS,
      1000,
      5,
      MAX_TRACKED_CLIENTS,
    );
    const now = 2_000_000;
    for (let i = 0; i < 5; i += 1) limiter.recordFailure(`client-${i}`, now);
    // None of these five clients individually exceeded a per-client cap of 1000.
    expect(limiter.isBlocked("brand-new-client", now)).toBe(true);
  });

  test("a successful sign-in is not blocked by other clients' failures below the global ceiling", () => {
    const limiter = new LoginRateLimiter();
    const now = 3_000_000;
    for (let i = 0; i < 5; i += 1)
      limiter.recordFailure(`noisy-client-${i}`, now);
    expect(limiter.isBlocked("quiet-client", now)).toBe(false);
    limiter.recordSuccess("quiet-client");
    expect(limiter.isBlocked("quiet-client", now)).toBe(false);
  });

  test("a client's own success clears its own failures but not the global counter", () => {
    const limiter = new LoginRateLimiter(
      WINDOW_MS,
      3,
      MAX_FAILURES_GLOBAL,
      MAX_TRACKED_CLIENTS,
    );
    const now = 4_000_000;
    limiter.recordFailure("client-a", now);
    limiter.recordFailure("client-a", now);
    limiter.recordSuccess("client-a");
    // Cleared: two more failures are needed before client-a is blocked again.
    limiter.recordFailure("client-a", now);
    limiter.recordFailure("client-a", now);
    expect(limiter.isBlocked("client-a", now)).toBe(false);
    limiter.recordFailure("client-a", now);
    expect(limiter.isBlocked("client-a", now)).toBe(true);
  });

  test("an XFF-spoofing attacker cannot bypass the limit by varying the forged prefix", () => {
    const limiter = new LoginRateLimiter();
    const now = 5_000_000;
    const prefixes = [
      "1.1.1.1",
      "2.2.2.2",
      "3.3.3.3",
      "4.4.4.4",
      "5.5.5.5",
      "6.6.6.6",
    ];
    const real = "203.0.113.9";
    for (const prefix of prefixes.slice(0, 5)) {
      const key = clientKey(request(`${prefix}, ${real}`));
      limiter.recordFailure(key, now);
    }
    for (let i = 5; i < 10; i += 1) limiter.recordFailure(real, now);
    const nextKey = clientKey(request(`7.7.7.7, ${real}`));
    expect(limiter.isBlocked(nextKey, now)).toBe(true);
  });

  test("bounds memory: the tracked-client map never exceeds its configured cap", () => {
    const limiter = new LoginRateLimiter(
      WINDOW_MS,
      MAX_FAILURES_PER_CLIENT,
      MAX_FAILURES_GLOBAL,
      50,
    );
    const now = 6_000_000;
    for (let i = 0; i < 500; i += 1) limiter.recordFailure(`client-${i}`, now);
    expect(limiter.trackedClients).toBeLessThanOrEqual(50);
  });

  test("expired entries are evicted, not merely ignored, once the window has passed", () => {
    const limiter = new LoginRateLimiter();
    const start = 7_000_000;
    limiter.recordFailure("client-a", start);
    expect(limiter.trackedClients).toBe(1);
    // Touching the limiter well after expiry should drop the stale entry.
    limiter.isBlocked("client-a", start + WINDOW_MS + 1);
    expect(limiter.trackedClients).toBe(0);
  });
});
