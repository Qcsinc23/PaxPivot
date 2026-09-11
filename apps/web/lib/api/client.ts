/**
 * Server-only read client for `/api/v1`. Pages call it from server components; the token never
 * reaches the browser. Every outcome is explicit: a missing configuration, a rejected
 * credential, a missing record and an unreachable API are four different results, and none of
 * them is ever rendered as an absence of data.
 */
export type ApiFailure =
  | "not_configured"
  | "unauthorized"
  | "not_found"
  | "unavailable";

export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: ApiFailure };

export type ReadOptions = {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
};

export async function readApi<T>(
  path: string,
  { fetchImpl = fetch, env = process.env }: ReadOptions = {},
): Promise<ApiResult<T>> {
  if (typeof window !== "undefined") {
    throw new Error(
      "readApi is server-only: the API token must never reach the browser",
    );
  }
  const base = env.PAXPIVOT_API_URL;
  const token = env.PAXPIVOT_API_TOKEN;
  if (!base || !token) return { ok: false, reason: "not_configured" };
  let response: Response;
  try {
    response = await fetchImpl(new URL(path, base), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (response.status === 401) return { ok: false, reason: "unauthorized" };
  if (response.status === 404) return { ok: false, reason: "not_found" };
  if (!response.ok) return { ok: false, reason: "unavailable" };
  try {
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
