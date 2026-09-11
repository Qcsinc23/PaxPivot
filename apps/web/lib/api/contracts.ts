/**
 * Wire contracts of the read API (`/api/v1`), mirroring `apps/api/paxpivot/application/read_models.py`.
 * Hand-maintained; `apps/web/lib/api/examples/*.json` are generated from the Python models and
 * checked in both suites, so drift fails CI. Snake_case is the wire shape; adapters map it.
 */

export type RetrievalStateRead = "succeeded" | "failed" | "not_attempted";
export type ExtractionStateRead =
  | "not_attempted"
  | "exact_text"
  | "human_reviewed"
  | "failed";
export type PolicyReviewStateRead =
  | "approved"
  | "needs_review"
  | "paused"
  | "restricted";
export type SourceKindRead =
  | "terminal_page"
  | "schedule_artifact"
  | "directory_page"
  | "policy_document";
export type TerminalFactKindRead =
  | "counter_hours"
  | "phone"
  | "email"
  | "parking"
  | "passenger_terminal_note"
  | "uso_availability"
  | "access_note";

export type SourceEvidenceRead = {
  observation_id: string;
  /** One of the 13 SourceState codes; the adapter never re-derives it. */
  state: string;
  observed_at: string;
  source_time: string | null;
  retrieval: RetrievalStateRead;
  extraction: ExtractionStateRead;
  parser_version: string | null;
  explanation: string;
};

export type CoordinatesRead = { latitude: number; longitude: number };

export type TerminalSummaryRead = {
  terminal_id: string;
  name: string;
  installation: string | null;
  timezone: string;
  operational_state: string;
  entrance: CoordinatesRead | null;
  entrance_kind: string | null;
  official_url: string | null;
  latest: SourceEvidenceRead | null;
};

export type TerminalNetworkRead = {
  generated_at: string;
  terminals: TerminalSummaryRead[];
};

export type TerminalFactRead = {
  fact_id: string;
  kind: TerminalFactKindRead;
  value: string;
  observed_at: string;
  source_time: string | null;
  source_url: string;
  effective_from: string | null;
  effective_to: string | null;
};

export type TerminalSourceRead = {
  source_id: string;
  name: string;
  url: string;
  kind: SourceKindRead;
  enabled: boolean;
  review_state: PolicyReviewStateRead;
  latest: SourceEvidenceRead | null;
};

export type TerminalDetailRead = {
  generated_at: string;
  summary: TerminalSummaryRead;
  entrance_instructions: string | null;
  facts: TerminalFactRead[];
  sources: TerminalSourceRead[];
};

export type SourceHealthRowRead = {
  source_id: string;
  name: string;
  url: string;
  kind: SourceKindRead;
  terminal_id: string | null;
  enabled: boolean;
  review_state: PolicyReviewStateRead;
  cadence_minutes: number | null;
  adapter_id: string | null;
  adapter_version: string | null;
  kill_switched: boolean;
  latest: SourceEvidenceRead | null;
};

export type SourceStateCountRead = { state: string; count: number };

export type SourceHealthRead = {
  generated_at: string;
  rows: SourceHealthRowRead[];
  counts: SourceStateCountRead[];
  never_observed: number;
};

/* ── trip requests (TASK-034) ─────────────────────────────────────── */

/** What the traveler asked for. No eligibility, route or probability: none exists yet. */
export type TripRead = {
  trip_id: string;
  origin_terminal_id: string;
  origin_terminal_name: string;
  destination_text: string;
  window_start: string;
  window_end: string;
  party_size: number;
  created_at: string;
};

export type TripListRead = { trips: TripRead[] };

export type NewTripRequestWire = {
  origin_terminal_id: string;
  destination_text: string;
  window_start: string;
  window_end: string;
  party_size: number;
};
