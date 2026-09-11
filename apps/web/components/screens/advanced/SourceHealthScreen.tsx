import Link from "next/link";
import type { CSSProperties } from "react";
import { SourceStateBadge } from "@/components/paxpivot/SourceStateBadge";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { FactValue } from "@/components/ui/Facts";
import { StatusPill, type PillTone } from "@/components/ui/Pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { sourceCountText } from "@/lib/presentation/notices";
import type {
  SourceApproval,
  SourceHealthScreenModel,
} from "@/lib/presentation/screens/advanced";

/*
 * Table styling as token-valued inline styles, matching TASK-010: this task owns only
 * `screens.css`, and that file is limited to the wide-layout classes.
 */
const TABLE: CSSProperties = {
  width: "100%",
  minWidth: "46rem",
  borderCollapse: "collapse",
  fontSize: "0.8125rem",
};

const CELL: CSSProperties = {
  padding: "var(--space-2)",
  borderBottom: "1px solid var(--color-divider)",
  textAlign: "left",
  verticalAlign: "top",
};

const CAPTION: CSSProperties = {
  textAlign: "left",
  paddingBottom: "var(--space-2)",
  fontSize: "0.75rem",
  color: "var(--color-neutral-700)",
};

const SCROLL: CSSProperties = { overflowX: "auto", contain: "paint" };

/** Whether the source-processing policy allows this source to be read. Text, never colour alone. */
const APPROVAL: Readonly<
  Record<SourceApproval, { text: string; tone: PillTone }>
> = {
  approved: { text: "Approved", tone: "verified" },
  review: { text: "Needs review", tone: "caution" },
  paused: { text: "Paused", tone: "unknown" },
  unknown: { text: "Unknown", tone: "unknown" },
};

const COLUMNS = [
  "Source",
  "State",
  "Page time",
  "We read it",
  "Cadence",
  "Reader",
];

type Props = { model: SourceHealthScreenModel };

/**
 * Advanced · source health. An internal operations view: it reports the state, times, cadence,
 * reader and approval the application established, and reproduces no movement rows.
 */
export function SourceHealthScreen({ model }: Props) {
  const header = (
    <AppHeader
      title="Source health"
      subtitle="Operations view"
      back={{ href: "/profile" }}
    />
  );

  if (model.status === "empty") {
    return (
      <>
        {header}
        <EmptyState
          title="No sources are being checked yet"
          body="Once sources are registered, their state and cadence appear here."
        />
      </>
    );
  }

  if (model.status === "loading") {
    return (
      <>
        {header}
        <LoadingState title="Source health" body="Loading source checks." />
      </>
    );
  }

  if (model.status === "error") {
    return (
      <>
        {header}
        <ErrorState
          title="We could not load source health"
          body="This is a failure on our side, not a statement about any source."
        />
      </>
    );
  }

  return (
    <>
      {header}

      <p className="pp-meta">
        You do not need this screen unless something looks wrong.
      </p>

      {model.summary.length > 0 ? (
        <ul className="pp-card__hd" aria-label="States across sources">
          {model.summary.map((entry, index) => (
            <li key={`${entry.evidence.state}-${index}`}>
              <span className="pp-fact__l">{sourceCountText(entry.count)}</span>{" "}
              <SourceStateBadge evidence={entry.evidence} />
            </li>
          ))}
        </ul>
      ) : null}

      <Card as="div">
        <div style={SCROLL}>
          <table style={TABLE}>
            <caption style={CAPTION}>
              Source checks and their current state
            </caption>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column} scope="col" style={CELL}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => {
                const approval = APPROVAL[row.approval];
                return (
                  <tr key={row.id}>
                    <th scope="row" style={{ ...CELL, fontWeight: 600 }}>
                      <Link href={row.openHref}>{row.name}</Link>
                      <span
                        style={{
                          display: "block",
                          marginTop: "var(--space-1)",
                        }}
                      >
                        <StatusPill tone={approval.tone}>
                          {approval.text}
                        </StatusPill>
                      </span>
                    </th>
                    <td style={CELL}>
                      <SourceStateBadge evidence={row.evidence} />
                    </td>
                    <td style={CELL}>
                      <FactValue fact={row.pageTime} className="" />
                    </td>
                    <td style={CELL}>
                      <FactValue fact={row.readAt} className="" />
                    </td>
                    <td style={CELL}>
                      <FactValue fact={row.cadence} className="" />
                    </td>
                    <td style={CELL}>
                      <FactValue fact={row.reader} className="" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {model.notices.length > 0 ? (
        <section style={{ display: "grid", gap: "var(--space-3)" }}>
          <h2 className="pp-title">Needs attention</h2>
          <ul
            aria-label="Source notices"
            style={{ display: "grid", gap: "var(--space-3)" }}
          >
            {model.notices.map((notice) => (
              <li key={notice.id}>
                <Card as="article" tone="muted">
                  <h3 className="pp-card__title">{notice.title}</h3>
                  <p className="pp-sub">{notice.body}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
