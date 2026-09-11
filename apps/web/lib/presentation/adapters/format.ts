/**
 * Formatting only. These helpers turn decided values into display strings; they never decide
 * freshness, state or availability. Times render in UTC so output is deterministic.
 */
import type { SourceEvidenceRead } from "@/lib/api/contracts";
import { isSourceStateCode } from "@/lib/presentation/source-state";
import type { SourceEvidenceView, StatusTone } from "@/lib/presentation/types";
import { lexemeFor } from "@/components/paxpivot/SourceStateBadge";

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-09-10 11:30Z" */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
}

/** "9m", "3h", "3d" — elapsed since `iso` at `now`; never negative. */
export function formatAge(iso: string, now: Date): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - new Date(iso).getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** "Every 30 min", "Every 6 h" */
export function formatCadence(minutes: number): string {
  return minutes % 60 === 0 && minutes >= 60
    ? `Every ${minutes / 60} h`
    : `Every ${minutes} min`;
}

/**
 * The state code passes through verbatim. A code the lexicon does not know still passes
 * through: the badge renders it as "Unknown state" rather than the adapter guessing.
 */
export function toEvidenceView(
  read: SourceEvidenceRead,
  now: Date,
): SourceEvidenceView {
  return {
    state: isSourceStateCode(read.state) ? read.state : "source_missing",
    ageText: formatAge(read.observed_at, now),
    explanation: read.explanation,
  };
}

export function evidenceTone(read: SourceEvidenceRead | null): StatusTone {
  return read ? lexemeFor(read.state).tone : "unknown";
}
