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
  | "invalid"
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
  options: ReadOptions = {},
): Promise<ApiResult<T>> {
  return callApi<T>(path, undefined, options);
}

/** Server-only JSON POST. `invalid` is the API refusing the request body (422). */
export async function writeApi<T>(
  path: string,
  body: unknown,
  options: ReadOptions = {},
): Promise<ApiResult<T>> {
  return callApi<T>(path, body, options);
}

async function callApi<T>(
  path: string,
  body: unknown,
  { fetchImpl = fetch, env = process.env }: ReadOptions,
): Promise<ApiResult<T>> {
  if (typeof window !== "undefined") {
    throw new Error(
      "the API client is server-only: the API token must never reach the browser",
    );
  }
  const base = env.PAXPIVOT_API_URL;
  const token = env.PAXPIVOT_API_TOKEN;
  if (!base || !token) return { ok: false, reason: "not_configured" };
  let response: Response;
  try {
    response = await fetchImpl(new URL(path, base), {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (response.status === 401) return { ok: false, reason: "unauthorized" };
  if (response.status === 404) return { ok: false, reason: "not_found" };
  if (response.status === 422) return { ok: false, reason: "invalid" };
  if (!response.ok) return { ok: false, reason: "unavailable" };
  try {
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
