/**
 * In-memory brute-force limiter for `POST /auth/session` (TASK-046; ADR-005 amendment
 * 2026-09-14, revised same day after review). The pilot's timing-safe compare and fixed failure
 * delay (ADR-005) slow a single sequential guesser but cost nothing in aggregate against
 * parallel attempts; this adds two independent tiers:
 *
 * - **Per-client cap** (`isClientBlocked`): a client with `MAX_FAILURES_PER_CLIENT` failures in
 *   the window is refused even with the correct passphrase, until the window slides. This is
 *   the only check that can ever deny a correct passphrase, and it only ever depends on that
 *   client's own history.
 * - **Global ceiling** (`isGlobalThrottled`): once `MAX_FAILURES_GLOBAL` failures land in the
 *   window from any mix of clients, further *wrong* attempts get a longer failure delay
 *   (`GLOBAL_THROTTLE_DELAY_MS`) instead of the ordinary one. It never blocks a correct
 *   passphrase from a client that isn't itself over its own cap — a first design of this
 *   limiter did exactly that, and a review of this task found it turns the global ceiling into
 *   a trivial denial-of-service against the pilot's one legitimate user: `MAX_FAILURES_GLOBAL`
 *   (200) is reachable with `MAX_FAILURES_GLOBAL / MAX_FAILURES_PER_CLIENT` = 20 distinct
 *   client keys each failing 10 times — about 13 failed requests a minute spread over 20 IPs
 *   sustains it indefinitely. A ~20-IP botnet or open proxy list is a low bar, so a ceiling that
 *   *blocks* rather than merely *slows* is worse than not having one for a single-user pilot:
 *   this module now guarantees only the per-client cap can turn away a correct passphrase.
 *
 * ponytail: bounded by MAX_TRACKED_CLIENTS entries of at most MAX_FAILURES_PER_CLIENT
 * timestamps each, plus one global array capped at MAX_FAILURES_GLOBAL — per-process memory,
 * reset on restart, correct only because this pilot runs a single `web` replica
 * (`compose.prod.yml`, `docs/DEPLOYMENT.md`). A future multi-replica deployment needs shared
 * state (e.g. Redis) instead of this module.
 */

export const WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_CLIENT = 10;
/** Reachable by MAX_FAILURES_GLOBAL / MAX_FAILURES_PER_CLIENT = 20 distinct clients. */
export const MAX_FAILURES_GLOBAL = 200;
export const MAX_TRACKED_CLIENTS = 5000;
export const FAILURE_DELAY_MS = 500;
/** Applied to a wrong passphrase only while the global ceiling is tripped; never to a correct one. */
export const GLOBAL_THROTTLE_DELAY_MS = 5_000;

/**
 * The identity a failed sign-in is counted against: the right-most `X-Forwarded-For` entry.
 *
 * Verified live, read-only, 2026-09-14: the DNS A record for `paxpivot.qcs-cargo.com` resolves
 * directly to the VPS (`82.25.85.157`) with no CDN or other proxy in front, and the host's
 * Traefik v2.11 static configuration (`/etc/dokploy/traefik/traefik.yml`, Dokploy-managed)
 * defines entrypoints `web` (:80) and `websecure` (:443) with neither
 * `forwardedHeaders.trustedIPs` nor `forwardedHeaders.insecure` set. With neither set, Traefik
 * does not trust any client-supplied `X-Forwarded-*` header as authoritative — the
 * `X-Forwarded-For` it hands to `web` is built from what Traefik itself saw, ending in the
 * actual TCP peer address. (No empirical forged-`X-Forwarded-For` probe was run against the
 * live host: the operator shares that network, and a wrong assumption would risk locking
 * themselves out — this rests on reading the static configuration, not a live attack test.)
 *
 * A client can still send its own `X-Forwarded-For` with any forged prefix it likes — the whole
 * point of the attack this task closes is that the client is untrusted — but it cannot make
 * Traefik *not* append the true peer address as the header's right-most entry. `clientKey()`
 * therefore reads only that right-most entry — the only part of the header this specific,
 * verified topology can trust — and ignores everything to its left. Reading anything else (the
 * left-most entry, or the client's own `X-Forwarded-For` when there is no proxy) would let one
 * attacker present a different "client" on every request and defeat the per-client cap for
 * free.
 *
 * **Re-verify this if the topology changes**: a CDN or another reverse proxy placed in front of
 * Traefik, or a change to either entrypoint's `forwardedHeaders` settings, can change which
 * entry (if any) is trustworthy. A deployment with more hops in front of `web` would need to
 * trust the Nth-from-the-right entry instead, for the same reason this one trusts the last.
 *
 * When the header is absent entirely (no proxy in front — local/dev only, since production
 * always runs behind Traefik), every such request shares one fixed key; that only weakens the
 * per-client cap into a shared one for a topology this deployment does not use.
 */
export function clientKey(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (!xff) return "no-forwarded-for";
  const parts = xff
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : "no-forwarded-for";
}

/** The delay for a wrong passphrase: longer while the global ceiling is tripped. */
export function failureDelayMs(globalThrottled: boolean): number {
  return globalThrottled ? GLOBAL_THROTTLE_DELAY_MS : FAILURE_DELAY_MS;
}

export type LoginRateLimiterOptions = {
  windowMs?: number;
  maxFailuresPerClient?: number;
  maxFailuresGlobal?: number;
  maxTrackedClients?: number;
  /**
   * Called at most once per "trip" of the global ceiling — when the window's failure count
   * crosses from under the ceiling to at/over it — never on every request while it stays
   * tripped, and eligible to fire again after the count later drops back below the ceiling.
   * Defaults to one structured log line with no IP, no passphrase, and no count that could
   * identify a client.
   */
  onGlobalThrottleTripped?: () => void;
};

function defaultOnGlobalThrottleTripped(): void {
  console.info(JSON.stringify({ event: "auth_global_rate_limit_tripped" }));
}

export class LoginRateLimiter {
  private readonly clients = new Map<string, number[]>();
  private globalFailures: number[] = [];
  private globalThrottleActive = false;
  private readonly windowMs: number;
  private readonly maxPerClient: number;
  private readonly maxGlobal: number;
  private readonly maxClients: number;
  private readonly onGlobalThrottleTripped: () => void;

  constructor(options: LoginRateLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? WINDOW_MS;
    this.maxPerClient = options.maxFailuresPerClient ?? MAX_FAILURES_PER_CLIENT;
    this.maxGlobal = options.maxFailuresGlobal ?? MAX_FAILURES_GLOBAL;
    this.maxClients = options.maxTrackedClients ?? MAX_TRACKED_CLIENTS;
    this.onGlobalThrottleTripped =
      options.onGlobalThrottleTripped ?? defaultOnGlobalThrottleTripped;
  }

  /**
   * True when this specific client has failed too often to try again now. This is the only
   * check in this module that can ever refuse a correct passphrase, and it depends only on
   * `key`'s own recent history — never on other clients' failures or the global ceiling.
   */
  isClientBlocked(key: string, now: number): boolean {
    return this.freshenClient(key, now) >= this.maxPerClient;
  }

  /**
   * True when the process-wide failure count is at the ceiling right now. Never a reason to
   * refuse a correct passphrase (see `isClientBlocked`); callers use this only to pick a longer
   * failure delay for a *wrong* passphrase, turning a distributed attack into a global slowdown
   * rather than a lockout of the pilot's one legitimate user.
   */
  isGlobalThrottled(now: number): boolean {
    return this.refreshGlobal(now);
  }

  /**
   * Record one failed sign-in attempt against `key`, evicting anything outside the window.
   * Returns whether the global ceiling is tripped after recording this failure, so the caller
   * can choose this response's delay.
   */
  recordFailure(key: string, now: number): boolean {
    const times = this.fresh(this.clients.get(key), now);
    times.push(now);
    // Delete-then-set moves the key to the end of the Map's iteration order, so `evictOldest`
    // (used only under sustained load from many distinct keys) reclaims idle clients first.
    this.clients.delete(key);
    this.clients.set(key, times);
    this.globalFailures = this.fresh(this.globalFailures, now);
    this.globalFailures.push(now);
    this.evictOldest();
    return this.refreshGlobal(now);
  }

  /**
   * A successful sign-in clears this client's own failure history. It never touches the global
   * counter: the global ceiling exists to slow down damage from many distinct attackers, not to
   * reward one legitimate client for succeeding.
   */
  recordSuccess(key: string): void {
    this.clients.delete(key);
  }

  /** Test/diagnostic hook: how many distinct clients currently have tracked failures. */
  get trackedClients(): number {
    return this.clients.size;
  }

  private freshenClient(key: string, now: number): number {
    const times = this.fresh(this.clients.get(key), now);
    if (times.length === 0) this.clients.delete(key);
    else this.clients.set(key, times);
    return times.length;
  }

  private fresh(times: number[] | undefined, now: number): number[] {
    const cutoff = now - this.windowMs;
    return (times ?? []).filter((t) => t > cutoff);
  }

  /** Refreshes the global window, firing `onGlobalThrottleTripped` exactly on the transition. */
  private refreshGlobal(now: number): boolean {
    this.globalFailures = this.fresh(this.globalFailures, now);
    const active = this.globalFailures.length >= this.maxGlobal;
    if (active && !this.globalThrottleActive) this.onGlobalThrottleTripped();
    this.globalThrottleActive = active;
    return active;
  }

  private evictOldest(): void {
    while (this.clients.size > this.maxClients) {
      const oldest = this.clients.keys().next().value;
      if (oldest === undefined) break;
      this.clients.delete(oldest);
    }
  }
}

/** The single process-wide limiter every `/auth/session` request shares. */
export const loginRateLimiter = new LoginRateLimiter();
