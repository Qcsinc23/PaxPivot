/**
 * Source health view model (TASK-016).
 *
 * The internal operations view: what each source last reported, when the page itself said it was
 * current, when we read it, how often we check, which reader version did the work, and whether
 * the source is approved for processing. Nothing here re-derives a state from timestamps, and no
 * movement row is ever reproduced for an unapproved source.
 */
import { known, unknown, type Fact } from "@/lib/presentation/fact";
import type { SourceEvidenceView } from "@/lib/presentation/types";

/** Whether the source-processing policy allows this source to be read at all. */
export type SourceApproval =
  | "approved"
  | "review"
  | "paused"
  | "restricted"
  | "unknown";

export type SourceHealthRowView = {
  id: string;
  name: string;
  /** Omitted when PaxPivot has never read this source ("Not checked yet"). */
  evidence?: SourceEvidenceView;
  /** What the page itself claimed, as text. Unknown when it showed no timestamp. */
  pageTime: Fact<string>;
  /** When PaxPivot last read it. */
  readAt: Fact<string>;
  cadence: Fact<string>;
  reader: Fact<string>;
  approval: SourceApproval;
  /** An operator stopped processing this source, its adapter or a mode; history is untouched. */
  killSwitched?: boolean;
  openHref: string;
};

export type SourceHealthNoticeView = {
  id: string;
  kind: "conflict" | "missing" | "restricted";
  title: string;
  body: string;
};

export type SourceHealthScreenModel = {
  status: "empty" | "ready" | "loading" | "error";
  summary: readonly { evidence: SourceEvidenceView; count: number }[];
  rows: readonly SourceHealthRowView[];
  notices: readonly SourceHealthNoticeView[];
};

const SYNTHETIC_EXPLANATION =
  "Synthetic fixture explanation. In production this text is the deterministic source-state explanation supplied by the application.";

/** The live route's model until an operations API contract exists. It carries no product data. */
export const emptySourceHealth: SourceHealthScreenModel = {
  status: "empty",
  summary: [],
  rows: [],
  notices: [],
};

/** Synthetic fixture for tests and the development showcase. Never rendered by a live route. */
export const fixtureSourceHealth: SourceHealthScreenModel = {
  status: "ready",
  summary: [
    { evidence: { state: "fresh" }, count: 4 },
    { evidence: { state: "source_stale" }, count: 1 },
    { evidence: { state: "source_unreachable" }, count: 1 },
    { evidence: { state: "source_conflict" }, count: 1 },
  ],
  rows: [
    {
      id: "source-a",
      name: "Example Terminal A",
      evidence: {
        state: "fresh",
        ageText: "9m",
        explanation: SYNTHETIC_EXPLANATION,
      },
      pageTime: known("15:30Z"),
      readAt: known("15:44Z"),
      cadence: known("Every 30 min"),
      reader: known("v0 (example)"),
      approval: "approved",
      openHref: "https://example.invalid/terminal-a",
    },
    {
      id: "source-c",
      name: "Example Terminal C",
      evidence: {
        state: "source_stale",
        ageText: "3d",
        explanation: SYNTHETIC_EXPLANATION,
      },
      pageTime: unknown("Page showed no timestamp"),
      readAt: known("2026-01-01 06:00Z"),
      cadence: known("Every 6 h"),
      reader: known("v0 (example)"),
      approval: "approved",
      openHref: "https://example.invalid/terminal-c",
    },
    {
      id: "source-d",
      name: "Example Terminal D",
      evidence: {
        state: "source_unreachable",
        explanation: SYNTHETIC_EXPLANATION,
      },
      pageTime: unknown(),
      readAt: unknown("No successful read"),
      cadence: known("Every 30 min"),
      reader: unknown("Not determined"),
      approval: "review",
      openHref: "https://example.invalid/terminal-d",
    },
    {
      id: "source-e",
      name: "Example Terminal E",
      evidence: {
        state: "restricted_user_open_only",
        explanation: SYNTHETIC_EXPLANATION,
      },
      pageTime: unknown(),
      readAt: unknown(),
      cadence: unknown("Not scheduled"),
      reader: unknown(),
      approval: "paused",
      openHref: "https://example.invalid/terminal-e",
    },
  ],
  notices: [
    {
      id: "notice-conflict",
      kind: "conflict",
      title: "Two official sources disagree",
      body: "Example Terminal B published two different departure times. Held until a person decides.",
    },
    {
      id: "notice-missing",
      kind: "missing",
      title: "An artifact is missing",
      body: "The expected schedule file for Example Terminal D was not found at the published address.",
    },
    {
      id: "notice-restricted",
      kind: "restricted",
      title: "A source is restricted",
      body: "Example Terminal E may only be opened by a person. PaxPivot does not reproduce its rows.",
    },
  ],
};
