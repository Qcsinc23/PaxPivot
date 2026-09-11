import { writeApi } from "@/lib/api/client";
import type { NewTripRequestWire, TripRead } from "@/lib/api/contracts";
import { redirectTo } from "@/lib/auth/guard";

/** A `datetime-local` value has no zone; the pilot treats it as UTC and says so nowhere else. */
function toIso(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text)) return null;
  const date = new Date(`${text}Z`);
  if (Number.isNaN(date.getTime())) return null;
  // V8 rolls an impossible day (Feb 31) forward; a value that does not round-trip is rejected.
  if (!date.toISOString().startsWith(text.slice(0, 16))) return null;
  return date.toISOString();
}

/** POST form → `POST /api/v1/trips` → 303 to the new trip. The API makes the final decision. */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const windowStart = toIso(form.get("window_start"));
  const windowEnd = toIso(form.get("window_end"));
  const partySize = Number(form.get("party_size"));
  const body: NewTripRequestWire = {
    origin_terminal_id: String(form.get("origin_terminal_id") ?? ""),
    destination_text: String(form.get("destination_text") ?? "").trim(),
    window_start: windowStart ?? "",
    window_end: windowEnd ?? "",
    party_size: Number.isInteger(partySize) ? partySize : 0,
  };
  if (!windowStart || !windowEnd || !body.destination_text) {
    return redirectTo("/?error=invalid");
  }
  const result = await writeApi<TripRead>("/api/v1/trips", body);
  if (!result.ok) {
    return redirectTo(
      result.reason === "invalid" ? "/?error=invalid" : "/?error=unavailable",
    );
  }
  return redirectTo(`/trips/${result.value.trip_id}`);
}
