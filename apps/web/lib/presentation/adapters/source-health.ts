/**
 * `/api/v1/sources/health` → Advanced source-health screen model. The review state, kill
 * switch flag and every observation state are the application's; a source that was never
 * observed is shown as "not checked yet", never as any source state.
 */
import type {
  PolicyReviewStateRead,
  SourceHealthRead,
  SourceHealthRowRead,
} from "@/lib/api/contracts";
import { known, unknown } from "@/lib/presentation/fact";
import type {
  SourceApproval,
  SourceHealthNoticeView,
  SourceHealthRowView,
  SourceHealthScreenModel,
} from "@/lib/presentation/screens/advanced";
import { isSourceStateCode } from "@/lib/presentation/source-state";
import type { AdapterOptions } from "./terminals";
import { formatCadence, formatTimestamp, toEvidenceView } from "./format";

const APPROVAL: Readonly<Record<PolicyReviewStateRead, SourceApproval>> = {
  approved: "approved",
  needs_review: "review",
  paused: "paused",
  restricted: "restricted",
};

export function toSourceHealthRow(
  row: SourceHealthRowRead,
  { now }: AdapterOptions,
): SourceHealthRowView {
  const latest = row.latest;
  return {
    id: row.source_id,
    name: row.name,
    evidence: latest ? toEvidenceView(latest, now) : undefined,
    pageTime: latest
      ? latest.source_time
        ? known(formatTimestamp(latest.source_time))
        : unknown("Page showed no timestamp")
      : unknown("Not checked yet"),
    readAt: latest
      ? known(formatTimestamp(latest.observed_at))
      : unknown("Not checked yet"),
    cadence:
      row.cadence_minutes !== null
        ? known(formatCadence(row.cadence_minutes))
        : unknown("Not scheduled"),
    reader:
      row.adapter_id && row.adapter_version
        ? known(`${row.adapter_id} ${row.adapter_version}`)
        : unknown("Not assigned"),
    approval: APPROVAL[row.review_state],
    killSwitched: row.kill_switched,
    openHref: row.url,
  };
}

/** Notices restate decided states in operator wording; they add no finding of their own. */
export function toNotices(
  rows: readonly SourceHealthRowRead[],
): SourceHealthNoticeView[] {
  const notices: SourceHealthNoticeView[] = [];
  for (const row of rows) {
    const state = row.latest?.state;
    if (state === "source_conflict") {
      notices.push({
        id: `conflict-${row.source_id}`,
        kind: "conflict",
        title: `Conflicting evidence for ${row.name}`,
        body: row.latest?.explanation ?? "",
      });
    } else if (state === "source_missing") {
      notices.push({
        id: `missing-${row.source_id}`,
        kind: "missing",
        title: `An artifact is missing for ${row.name}`,
        body: row.latest?.explanation ?? "",
      });
    }
    if (
      row.review_state === "restricted" ||
      state === "restricted_user_open_only"
    ) {
      notices.push({
        id: `restricted-${row.source_id}`,
        kind: "restricted",
        title: `${row.name} is restricted`,
        body: "PaxPivot does not retrieve or reproduce it. Open the official page yourself.",
      });
    }
  }
  return notices;
}

export function toSourceHealthScreenModel(
  read: SourceHealthRead,
  options: AdapterOptions,
): SourceHealthScreenModel {
  return {
    status: read.rows.length > 0 ? "ready" : "empty",
    summary: read.counts.flatMap((c) =>
      isSourceStateCode(c.state)
        ? [{ evidence: { state: c.state }, count: c.count }]
        : [],
    ),
    rows: read.rows.map((row) => toSourceHealthRow(row, options)),
    notices: toNotices(read.rows),
  };
}
