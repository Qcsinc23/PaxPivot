/**
 * In-memory brute-force limiter for `POST /auth/session` (TASK-046; ADR-005 amendment
 * 2026-09-14). The pilot's timing-safe compare and fixed failure delay (ADR-005) slow a single
 * sequential guesser but cost nothing in aggregate against parallel attempts; this adds an
 * actual ceiling.
 *
 * ponytail: bounded by MAX_TRACKED_CLIENTS entries of at most MAX_FAILURES_PER_CLIENT
 * timestamps each, plus one global array capped at MAX_FAILURES_GLOBAL — per-process memory,
 * reset on restart, correct only because this pilot runs a single `web` replica behind one
 * Traefik hop (`compose.prod.yml`, `docs/DEPLOYMENT.md`). A future multi-replica deployment
 * needs shared state (e.g. Redis) instead of this module.
 */

export const WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_CLIENT = 10;
export const MAX_FAILURES_GLOBAL = 200;
export const MAX_TRACKED_CLIENTS = 5000;

/**
 * The identity a failed sign-in is counted against: the right-most `X-Forwarded-For` entry.
 *
 * The deployment is one Traefik hop in front of `web` (`deploy/compose.traefik.yml`); Traefik
 * *appends* the real peer address to whatever `X-Forwarded-For` it received, it never trusts or
 * rewrites a client-supplied one. So the header's left-hand entries — if any — are whatever a
 * client chose to send and cannot be trusted, while the single right-most entry is always the
 * one Traefik itself added and is exactly the peer that opened the TCP connection. Reading
 * anything else (the left-most entry, or the client's own `X-Forwarded-For` when there is no
 * proxy) would let one attacker present a different "client" on every request and defeat the
 * per-client cap for free. A deployment with more hops in front of `web` would need to trust
 * the Nth-from-the-right entry instead, for the same reason.
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

export class LoginRateLimiter {
  private readonly clients = new Map<string, number[]>();
  private globalFailures: number[] = [];

  constructor(
    private readonly windowMs: number = WINDOW_MS,
    private readonly maxPerClient: number = MAX_FAILURES_PER_CLIENT,
    private readonly maxGlobal: number = MAX_FAILURES_GLOBAL,
    private readonly maxClients: number = MAX_TRACKED_CLIENTS,
  ) {}

  /** True when this client's own recent failures, or the process-wide total, are at the cap. */
  isBlocked(key: string, now: number): boolean {
    const clientCount = this.freshenClient(key, now);
    this.globalFailures = this.fresh(this.globalFailures, now);
    return (
      clientCount >= this.maxPerClient ||
      this.globalFailures.length >= this.maxGlobal
    );
  }

  /** Record one failed sign-in attempt against `key`, evicting anything outside the window. */
  recordFailure(key: string, now: number): void {
    const times = this.fresh(this.clients.get(key), now);
    times.push(now);
    // Delete-then-set moves the key to the end of the Map's iteration order, so `evictOldest`
    // (used only under sustained load from many distinct keys) reclaims idle clients first.
    this.clients.delete(key);
    this.clients.set(key, times);
    this.globalFailures = this.fresh(this.globalFailures, now);
    this.globalFailures.push(now);
    this.evictOldest();
  }

  /**
   * A successful sign-in clears this client's own failure history. It never touches the global
   * counter: the global ceiling exists to cap total damage from many distinct attackers, not to
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
