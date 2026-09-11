/**
 * Pilot access configuration (ADR-005). Two secrets, both server-only:
 *
 * - `PAXPIVOT_PILOT_PASSPHRASE` — what the one pilot user types at `/login`;
 * - `PAXPIVOT_SESSION_SECRET`   — signs the session cookie.
 *
 * Anything but an explicit development/test environment fails closed: with either missing,
 * every private route is refused (503), never served open. In development/test, both missing
 * means local work without a login.
 */
export type AccessConfig =
  | { mode: "configured"; passphrase: string; sessionSecret: string }
  | { mode: "development_open" }
  | { mode: "misconfigured"; reason: string };

export const MIN_SECRET_LENGTH = 32;
export const MIN_PASSPHRASE_LENGTH = 20;

export function accessConfig(
  env: Record<string, string | undefined> = process.env,
): AccessConfig {
  const passphrase = env.PAXPIVOT_PILOT_PASSPHRASE;
  const sessionSecret = env.PAXPIVOT_SESSION_SECRET;
  // Open is the exception, never the default: only an explicit development/test environment
  // may run without a sign-in. `staging`, `prod`, unset — anything else — fails closed.
  const development = env.NODE_ENV === "development" || env.NODE_ENV === "test";
  if (!passphrase && !sessionSecret) {
    return development
      ? { mode: "development_open" }
      : { mode: "misconfigured", reason: "access_not_configured" };
  }
  if (!passphrase || !sessionSecret) {
    return { mode: "misconfigured", reason: "access_partially_configured" };
  }
  if (sessionSecret.length < MIN_SECRET_LENGTH) {
    return { mode: "misconfigured", reason: "session_secret_too_short" };
  }
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return { mode: "misconfigured", reason: "passphrase_too_short" };
  }
  return { mode: "configured", passphrase, sessionSecret };
}
