/**
 * Source-state notice view models (TASK-008).
 *
 * These are the compact notices every results-style screen reuses for the pilot §11.3 view
 * states. They carry application truth only: which sources were checked, what each one said,
 * and how far a re-check has got. Nothing here derives a state, upgrades a failure into an
 * absence, or counts unknown as zero.
 */
import { known } from "@/lib/presentation/fact";
import { fixtureCommercial, fixtureLedger } from "@/lib/presentation/fixtures";
import type {
  CommercialBaselineView,
  FactView,
  SourceEvidenceView,
  SourceLedgerRowView,
} from "@/lib/presentation/types";

/** Sources being read right now. `done` is how many have finished; the screen never counts. */
export type RefreshNoticeView = {
  total: number;
  done: number;
  sources: readonly { name: string; evidence: SourceEvidenceView }[];
};

/** The previous result, kept on screen while a re-check runs. */
export type KeptResultNoticeView = {
  /** When the kept result was read, pre-formatted by the application. */
  fromText: string;
  /** The kept result's own state; the badge reports it and never upgrades it. */
  evidence: SourceEvidenceView;
  title: string;
  facts: readonly FactView[];
};

export type LateCheckNoticeView = {
  sourceName: string;
  /** When the check was expected. */
  dueText: string;
  /** How late it ran. */
  lateByText: string;
  evidence: SourceEvidenceView;
};

export type ConflictClaimView = {
  source: string;
  claim: string;
  dateText: string;
};

export type ConflictNoticeView = {
  sourceName: string;
  claims: readonly ConflictClaimView[];
  evidence: SourceEvidenceView;
};

export type NotRankedNoticeView = {
  count: number;
  rows: readonly SourceLedgerRowView[];
  href: string;
};

/** Nothing usable came back, and the screen says exactly that instead of "no flights". */
export type HonestAbsenceView = {
  title: string;
  summary: readonly { evidence: SourceEvidenceView; count: number }[];
  ledger: readonly SourceLedgerRowView[];
  nextAction: {
    title: string;
    body: string;
    action: { label: string; href: string };
  };
  commercial?: CommercialBaselineView;
  /** Where the "why can't you just say there are none" explanation lives. */
  whyHref: string;
};

const SYNTHETIC_EXPLANATION =
  "Synthetic fixture explanation. In production this text is the deterministic source-state explanation supplied by the application.";

/** "1 source" / "3 sources" — formatting only; the count itself is the application's. */
export function sourceCountText(count: number): string {
  return `${count} ${count === 1 ? "source" : "sources"}`;
}

/** Synthetic fixtures for tests and the development showcase. Never rendered by a live route. */
export const fixtureNotices = {
  refresh: {
    total: 4,
    done: 1,
    sources: [
      {
        name: "Example Terminal A",
        evidence: {
          state: "fresh",
          ageText: "9m",
          explanation: SYNTHETIC_EXPLANATION,
        },
      },
      {
        name: "Example Terminal C",
        evidence: {
          state: "source_stale",
          ageText: "3d",
          explanation: SYNTHETIC_EXPLANATION,
        },
      },
      {
        name: "Example Terminal D",
        evidence: {
          state: "source_unreachable",
          explanation: SYNTHETIC_EXPLANATION,
        },
      },
      {
        name: "Example Terminal E",
        evidence: {
          state: "restricted_user_open_only",
          explanation: SYNTHETIC_EXPLANATION,
        },
      },
    ],
  } satisfies RefreshNoticeView,

  kept: {
    fromText: "15:30Z",
    evidence: {
      state: "source_stale",
      ageText: "3d",
      explanation: SYNTHETIC_EXPLANATION,
    },
    title: "Example Terminal C → Example Terminal B",
    facts: [
      { label: "Space-A leg", value: known("1") },
      { label: "Handoffs", value: known("2") },
    ],
  } satisfies KeptResultNoticeView,

  late: {
    sourceName: "Example Terminal A",
    dueText: "Every 30 min",
    lateByText: "18 min",
    evidence: { state: "monitor_delayed", explanation: SYNTHETIC_EXPLANATION },
  } satisfies LateCheckNoticeView,

  conflict: {
    sourceName: "Example Terminal B",
    claims: [
      {
        source: "Official page",
        claim: "Departs 06:00",
        dateText: "2026-01-01",
      },
      {
        source: "Official notice",
        claim: "Departs 07:30",
        dateText: "2026-01-02",
      },
    ],
    evidence: { state: "source_conflict", explanation: SYNTHETIC_EXPLANATION },
  } satisfies ConflictNoticeView,

  notRanked: {
    count: 3,
    rows: fixtureLedger,
    href: "/showcase#sources",
  } satisfies NotRankedNoticeView,

  absence: {
    title: "No supported Space-A route yet",
    summary: [
      { evidence: { state: "no_compatible_opportunity" }, count: 2 },
      { evidence: { state: "source_stale" }, count: 1 },
      { evidence: { state: "source_unreachable" }, count: 1 },
    ],
    ledger: fixtureLedger,
    nextAction: {
      title: "Try the widest window you can travel",
      body: "A wider window lets us check more departures before we decide nothing fits.",
      action: { label: "Change the window", href: "/showcase#trip-settings" },
    },
    commercial: fixtureCommercial,
    whyHref: "/showcase#why-absence",
  } satisfies HonestAbsenceView,
};
