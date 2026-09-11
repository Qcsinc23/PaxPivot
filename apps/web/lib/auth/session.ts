/**
 * Signed session token for the single pilot user: `<issued-at-ms>.<hmac-sha256 hex>`.
 * WebCrypto only, so it runs in the proxy (edge) and in route handlers alike. No user id, no
 * claims: there is exactly one principal, and the signature plus expiry is the whole session.
 */
export const SESSION_COOKIE = "pp_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const encoder = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(message)),
  );
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string equality; a length mismatch is folded into the result, not short-cut. */
export function timingSafeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function issueSession(
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const issued = String(now.getTime());
  return `${issued}.${await hmac(secret, issued)}`;
}

export async function verifySession(
  secret: string,
  token: string | undefined,
  now: Date = new Date(),
): Promise<boolean> {
  if (!token) return false;
  const [issued, signature, ...rest] = token.split(".");
  if (!issued || !signature || rest.length > 0 || !/^\d+$/.test(issued))
    return false;
  const expected = await hmac(secret, issued);
  if (!timingSafeEqual(expected, signature)) return false;
  const age = now.getTime() - Number(issued);
  return age >= 0 && age <= SESSION_TTL_MS;
}
