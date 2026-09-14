/**
 * `/api/v1/profile` → the Profile screen's party and party-edit-form models (TASK-050).
 *
 * Only `traveler_id`, `role`, `category_attestation` and `age_band` are read here.
 * `TravelerFactsWire.traveler_class`/`accompanied` are explicit placeholders this profile never
 * collects (ADR-009) and are never surfaced. Eligibility state stays `unknown`: this adapter
 * counts travelers, an honest fact, but computes no eligibility conclusion.
 */
import type {
  PartyFactsWire,
  ProfileRead,
  TravelerFactsWire,
} from "@/lib/api/contracts";
import {
  blankPartyForm,
  emptyProfile,
  type PartyFormTravelerView,
  type PartyFormView,
  type PartyMemberView,
  type ProfileScreenModel,
} from "@/lib/presentation/screens/profile";

const EDIT_ACTION = "/profile/edit";

function formTraveler(traveler: TravelerFactsWire): PartyFormTravelerView {
  return {
    id: traveler.traveler_id,
    categoryAttestation: traveler.category_attestation,
    ageBand: traveler.age_band,
  };
}

export function toPartyForm(party: PartyFactsWire | null): PartyFormView {
  const sponsor = party?.travelers.find((t) => t.role === "sponsor");
  const dependents =
    party?.travelers.filter((t) => t.role === "dependent") ?? [];
  return {
    action: EDIT_ACTION,
    sponsor: sponsor ? formTraveler(sponsor) : blankPartyForm.sponsor,
    dependents: dependents.map(formTraveler),
  };
}

export function toPartyMembers(
  party: PartyFactsWire | null,
): readonly PartyMemberView[] {
  if (!party) return [];
  const sponsor = party.travelers.find((t) => t.role === "sponsor");
  const dependents = party.travelers.filter((t) => t.role === "dependent");
  const members: PartyMemberView[] = [];
  if (sponsor) {
    members.push({
      id: sponsor.traveler_id,
      name: "Sponsor",
      roleText: "Sponsor of the party",
    });
  }
  dependents.forEach((dependent, index) => {
    members.push({
      id: dependent.traveler_id,
      name: `Dependent ${index + 1}`,
      roleText: "Dependent of the sponsor",
    });
  });
  return members;
}

/** `errorParam` carries `?error=` from the edit route's redirect back to `/profile`. */
export function toProfileScreenModel(
  read: ProfileRead,
  errorParam?: string,
): ProfileScreenModel {
  const error =
    errorParam === "invalid" || errorParam === "unavailable"
      ? errorParam
      : undefined;
  return {
    ...emptyProfile,
    status: read.party ? "ready" : "empty",
    eligibility: {
      state: "unknown",
      travelerCount: read.party?.travelers.length ?? 0,
      detailHref: "/profile/eligibility",
    },
    party: toPartyMembers(read.party),
    partyForm: { ...toPartyForm(read.party), error },
  };
}
