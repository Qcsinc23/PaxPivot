/**
 * `/api/v1/terminals` → Terminals screen models. Formatting and mapping only: the registry,
 * the entrance verification and every source state arrive decided. Nothing here geocodes,
 * ranks, computes travel time or turns "never observed" into a state.
 */
import type {
  TerminalDetailRead,
  TerminalFactRead,
  TerminalNetworkRead,
  TerminalSummaryRead,
} from "@/lib/api/contracts";
import { known, unknown, type Fact } from "@/lib/presentation/fact";
import type {
  TerminalDetailScreenModel,
  TerminalNetworkScreenModel,
} from "@/lib/presentation/screens/terminals";
import type {
  EvidenceAgeView,
  EvidenceRowView,
  FactView,
  HistoricalSummaryView,
  MapMarkerView,
  MapView,
  TerminalCardView,
} from "@/lib/presentation/types";
import { lexemeFor } from "@/components/paxpivot/SourceStateBadge";
import {
  evidenceTone,
  formatAge,
  formatTimestamp,
  toEvidenceView,
} from "./format";

export type AdapterOptions = { now: Date };

const ENTRANCE_LABEL: Readonly<Record<string, string>> = {
  passenger_terminal: "Passenger terminal entrance",
  visitor_center: "Visitor center",
  documented_gate: "Documented gate",
};

/** Travel time is a trip-scoped computation that does not exist yet; it is unknown, not zero. */
const NO_TRIP = "Not computed for a trip yet";
const NOT_CHECKED = "Not checked yet";

/** SRC-006: history stays hidden until 30 days of observations exist. */
const NO_HISTORY: HistoricalSummaryView = {
  observed: unknown("Fewer than 30 days of checks"),
  successfulChecks: unknown(),
  periodText: "no history yet",
  sinceLastText: unknown(),
  medianSeats: unknown(),
  coverageNote: "History appears after 30 days of successful checks.",
};

export function terminalHref(terminalId: string): string {
  return `/terminals/${terminalId}`;
}

function statusText(summary: TerminalSummaryRead, now: Date): string {
  if (!summary.latest) return NOT_CHECKED;
  const lexeme = lexemeFor(summary.latest.state);
  return `${lexeme.label} · ${formatAge(summary.latest.observed_at, now)}`;
}

export function toTerminalCard(
  summary: TerminalSummaryRead,
  { now }: AdapterOptions,
): TerminalCardView {
  const verified = summary.entrance !== null && summary.entrance_kind !== null;
  return {
    id: summary.terminal_id,
    name: summary.name,
    installation: summary.installation ?? undefined,
    accessText: unknown(NO_TRIP),
    evidence: summary.latest ? toEvidenceView(summary.latest, now) : undefined,
    entrance: {
      status: verified ? "verified" : "unverified",
      label: verified
        ? known(
            ENTRANCE_LABEL[summary.entrance_kind ?? ""] ?? "Verified entrance",
          )
        : unknown("No verified passenger entrance on record"),
    },
    href: terminalHref(summary.terminal_id),
  };
}

/** Only a verified entrance becomes a marker; a registry row without one has no location. */
export function toMarker(
  summary: TerminalSummaryRead,
  { now }: AdapterOptions,
): MapMarkerView {
  return {
    id: summary.terminal_id,
    label: summary.name,
    kind: "terminal",
    tone: evidenceTone(summary.latest),
    statusText: statusText(summary, now),
    coordinates: summary.entrance
      ? known({
          latitude: summary.entrance.latitude,
          longitude: summary.entrance.longitude,
        })
      : unknown("No verified passenger entrance on record"),
    href: terminalHref(summary.terminal_id),
  };
}

function mapView(
  title: string,
  summaries: readonly TerminalSummaryRead[],
  options: AdapterOptions,
): MapView {
  const markers = summaries.map((s) => toMarker(s, options));
  return {
    title,
    status: markers.length > 0 ? "ready" : "empty",
    markers,
    note: "Basemap not loaded",
  };
}

export function toTerminalNetworkScreenModel(
  read: TerminalNetworkRead,
  options: AdapterOptions,
): TerminalNetworkScreenModel {
  return {
    status: read.terminals.length > 0 ? "ready" : "empty",
    summary: { reachable: unknown(NO_TRIP), excluded: unknown(NO_TRIP) },
    map: mapView("Terminal network", read.terminals, options),
    filter: "all",
    terminals: read.terminals.map((s) => toTerminalCard(s, options)),
  };
}

function factValue(
  facts: readonly TerminalFactRead[],
  kind: TerminalFactRead["kind"],
): Fact<string> {
  const fact = facts.find((f) => f.kind === kind);
  return fact ? known(fact.value) : unknown("Not published");
}

function ageView(
  summary: TerminalSummaryRead,
  now: Date,
): EvidenceAgeView | undefined {
  const latest = summary.latest;
  if (!latest) return undefined;
  return {
    sourceTime: latest.source_time
      ? known({
          iso: latest.source_time,
          text: formatTimestamp(latest.source_time),
        })
      : unknown("Page showed no timestamp"),
    observedAt: {
      iso: latest.observed_at,
      text: formatTimestamp(latest.observed_at),
    },
    ageText: known(formatAge(latest.observed_at, now)),
  };
}

/**
 * What to say when there are no opportunities to list. A failed or absent check must never be
 * worded as "none are published": that would turn a PaxPivot failure into a claim about the
 * world (PRD §9.5, paxpivot.md §11.3).
 */
function opportunitiesNote(summary: TerminalSummaryRead): string {
  const latest = summary.latest;
  if (!latest) {
    return "PaxPivot has not checked a source for this terminal yet.";
  }
  if (latest.retrieval === "failed") {
    return "The last check did not succeed, so nothing is known about departures here.";
  }
  if (latest.state === "no_departures_published") {
    return "This source published no departures.";
  }
  return "No opportunities are published for this terminal right now.";
}

export function toTerminalDetailScreenModel(
  read: TerminalDetailRead,
  options: AdapterOptions,
): TerminalDetailScreenModel {
  const { summary } = read;
  const terminal = toTerminalCard(summary, options);
  const stats: FactView[] = [
    {
      label: "Entrance",
      value:
        summary.entrance && summary.entrance_kind
          ? known(ENTRANCE_LABEL[summary.entrance_kind] ?? "Verified entrance")
          : unknown("Not verified"),
    },
    { label: "Hours", value: factValue(read.facts, "counter_hours") },
    {
      label: "Published opportunities",
      value: unknown("No approved schedule source yet"),
    },
    { label: "Parking", value: factValue(read.facts, "parking") },
  ];
  const evidenceRows: EvidenceRowView[] = read.sources.map((source) => ({
    id: source.source_id,
    label: source.name,
    value: source.latest
      ? known(lexemeFor(source.latest.state).label)
      : unknown(NOT_CHECKED),
    tone: evidenceTone(source.latest),
    href: source.url,
  }));
  return {
    status: "ready",
    terminal,
    map: mapView("Terminal map", [summary], options),
    stats,
    actions: {
      directionsHref: summary.entrance
        ? `https://www.google.com/maps/dir/?api=1&destination=${summary.entrance.latitude},${summary.entrance.longitude}`
        : undefined,
      officialHref: summary.official_url ?? undefined,
    },
    opportunities: [],
    opportunitiesNote: opportunitiesNote(summary),
    travel: { rows: [], handoffs: [] },
    evidence: {
      age: ageView(summary, options.now),
      rows: evidenceRows,
      whyIncluded:
        "Listed in the terminal registry. Travel-time inclusion for a trip is not computed yet.",
    },
    history: NO_HISTORY,
  };
}
