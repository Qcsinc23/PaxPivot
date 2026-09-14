import { writeApi } from "@/lib/api/client";
import type {
  AgeBandWire,
  CategoryAttestationWire,
  NewPartyWire,
  NewProfileTravelerWire,
  ProfileRead,
} from "@/lib/api/contracts";
import { redirectTo } from "@/lib/auth/guard";

const CATEGORY_ATTESTATIONS: readonly CategoryAttestationWire[] = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "unknown",
];
const AGE_BANDS: readonly AgeBandWire[] = [
  "under_14",
  "minor_14_or_older",
  "adult",
  "unknown",
];

function categoryAttestation(
  value: FormDataEntryValue | null,
): CategoryAttestationWire {
  const text = String(value ?? "");
  return (CATEGORY_ATTESTATIONS as readonly string[]).includes(text)
    ? (text as CategoryAttestationWire)
    : "unknown";
}

function ageBand(value: FormDataEntryValue | null): AgeBandWire {
  const text = String(value ?? "");
  return (AGE_BANDS as readonly string[]).includes(text)
    ? (text as AgeBandWire)
    : "unknown";
}

/** An existing traveler id is reused so an edit does not silently change who a row refers to;
 * a blank one (a freshly added dependent, or the first-ever save) gets a new id here. */
function travelerId(value: FormDataEntryValue | null): string {
  const text = String(value ?? "").trim();
  return text || crypto.randomUUID();
}

/** POST form → `PUT /api/v1/profile` → 303 back to `/profile`. The API makes the final
 * decision; this handler only shapes the form into the wire body. */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const sponsorId = travelerId(form.get("sponsor_id"));
  const sponsor: NewProfileTravelerWire = {
    traveler_id: sponsorId,
    role: "sponsor",
    category_attestation: categoryAttestation(
      form.get("sponsor_category_attestation"),
    ),
    // The form does not ask: a party sponsor is, by role, an adult (TASK-050/ADR-009).
    age_band: "adult",
    sponsor_id: null,
  };

  const dependentIds = form.getAll("dependent_id");
  const dependentCategories = form.getAll("dependent_category_attestation");
  const dependentAgeBands = form.getAll("dependent_age_band");
  const dependents: NewProfileTravelerWire[] = dependentIds.map(
    (id, index) => ({
      traveler_id: travelerId(id),
      role: "dependent",
      category_attestation: categoryAttestation(
        dependentCategories[index] ?? null,
      ),
      age_band: ageBand(dependentAgeBands[index] ?? null),
      sponsor_id: sponsorId,
    }),
  );

  const body: NewPartyWire = { travelers: [sponsor, ...dependents] };
  const result = await writeApi<ProfileRead>("/api/v1/profile", body, {
    method: "PUT",
  });
  if (!result.ok) {
    return redirectTo(
      result.reason === "invalid"
        ? "/profile?error=invalid"
        : "/profile?error=unavailable",
    );
  }
  return redirectTo("/profile");
}
