/**
 * "Terminals to check" (TASK-044): an honest answer to "where should I go to fly?" for a trip,
 * built only from data the API already exposes. Every registered pilot terminal is listed, the
 * trip's origin first, in a stable order that the model states plainly is not a ranking. Each
 * row carries the terminal's own effective source state and read age (the same labels and
 * `ageView` pattern the terminal pages use), a link to its official page, and — for the
 * registered restricted 72-hour schedule source — a link to the folder the traveler must open
 * themselves. PaxPivot never fetches, parses or displays schedule-artifact contents here or
 * anywhere else; only the registered URL is ever linked.
 *
 * ponytail: the pilot ceiling is one `/api/v1/terminals/{id}` read per registered terminal
 * (currently 4) beside the single `/api/v1/terminals` list read, all run in parallel. Move this
 * composition into a dedicated API read model once the terminal network grows past pilot size,
 * or once these terminals must be ranked rather than listed in a stable order.
 */
import type { ApiResult } from "@/lib/api/client";
import type {
  TerminalDetailRead,
  TerminalNetworkRead,
  TerminalSummaryRead,
  TripRead,
} from "@/lib/api/contracts";
import { known, unknown, type Fact } from "@/lib/presentation/fact";
import type {
  EvidenceAgeView,
  FactView,
  Href,
  SourceEvidenceView,
} from "@/lib/presentation/types";
import { toEvidenceView } from "./format";
import { ageView } from "./terminals";

export const NOT_A_RANKING_NOTE =
  "Your origin terminal is listed first, then every other registered terminal in a stable order. This list is not a ranking of where flying is more likely.";

export const NO_SCHEDULE_ACCESS_NOTE =
  "PaxPivot does not read departure schedules yet.";

const SCHEDULE_LABEL = "72-hour schedule — open yourself";

const SCHEDULE_LOAD_FAILED =
  "PaxPivot could not load this terminal's schedule link right now. This is a failure on our side.";

const SCHEDULE_NOT_REGISTERED =
  "No 72-hour schedule source is registered for this terminal.";

const ALWAYS_UNKNOWN_FACTS: readonly FactView[] = [
  { label: "Destinations served", value: unknown() },
  { label: "Entrance", value: unknown("Not verified") },
  { label: "Drive time", value: unknown() },
];

export type TerminalToCheckRowView = {
  id: string;
  name: string;
  installation?: string;
  isOrigin: boolean;
  /** Omitted only when PaxPivot has never checked a source for this terminal. */
  evidence?: SourceEvidenceView;
  /** The page's own "current as of" time beside PaxPivot's read time; undefined = never read. */
  age?: EvidenceAgeView;
  officialHref?: Href;
  /** The registered restricted schedule folder, or why it cannot be linked right now. */
  schedule: Fact<{ href: Href; label: string }>;
  facts: readonly FactView[];
};

export type TerminalsToCheckViewModel = {
  notARankingNote: string;
  noScheduleAccessNote: string;
  rows: readonly TerminalToCheckRowView[];
};

function orderTerminals(
  terminals: readonly TerminalSummaryRead[],
  originTerminalId: string,
): readonly TerminalSummaryRead[] {
  const origin = terminals.filter((t) => t.terminal_id === originTerminalId);
  const others = [...terminals]
    .filter((t) => t.terminal_id !== originTerminalId)
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...origin, ...others];
}

function scheduleFact(
  detail: ApiResult<TerminalDetailRead> | undefined,
): Fact<{ href: Href; label: string }> {
  // No detail read was attempted for this terminal, or it failed: a source failure never hides
  // the terminal (the row still renders from the network summary), but the schedule link — the
  // one field this composition needs the detail read for — honestly says it is unavailable.
  if (!detail || !detail.ok) return unknown(SCHEDULE_LOAD_FAILED);
  const source = detail.value.sources.find(
    (s) => s.kind === "schedule_artifact",
  );
  if (!source) return unknown(SCHEDULE_NOT_REGISTERED);
  return known({ href: source.url, label: SCHEDULE_LABEL });
}

export function toTerminalsToCheckViewModel(
  trip: TripRead,
  network: TerminalNetworkRead,
  details: ReadonlyMap<string, ApiResult<TerminalDetailRead>>,
  { now }: { now: Date },
): TerminalsToCheckViewModel {
  const ordered = orderTerminals(network.terminals, trip.origin_terminal_id);
  return {
    notARankingNote: NOT_A_RANKING_NOTE,
    noScheduleAccessNote: NO_SCHEDULE_ACCESS_NOTE,
    rows: ordered.map((summary) => ({
      id: summary.terminal_id,
      name: summary.name,
      installation: summary.installation ?? undefined,
      isOrigin: summary.terminal_id === trip.origin_terminal_id,
      evidence: summary.latest
        ? toEvidenceView(summary.latest, now)
        : undefined,
      age: ageView(summary, now),
      officialHref: summary.official_url ?? undefined,
      schedule: scheduleFact(details.get(summary.terminal_id)),
      facts: ALWAYS_UNKNOWN_FACTS,
    })),
  };
}
