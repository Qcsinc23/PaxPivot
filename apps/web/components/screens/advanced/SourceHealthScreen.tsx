import Link from "next/link";
import { SourceStateBadge } from "@/components/paxpivot/SourceStateBadge";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { FactValue } from "@/components/ui/Facts";
import { StatusPill, type PillTone } from "@/components/ui/Pill";
import { ScreenSection } from "@/components/ui/ScreenSection";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { sourceCountText } from "@/lib/presentation/notices";
import type {
  SourceApproval,
  SourceHealthScreenModel,
} from "@/lib/presentation/screens/advanced";

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
        <div className="pp-table-wrap">
          <table className="pp-table pp-table--wide">
            <caption>Source checks and their current state</caption>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column} scope="col">
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
                    <th scope="row">
                      <Link href={row.openHref}>{row.name}</Link>
                      <span className="pp-table__title">
                        <StatusPill tone={approval.tone}>
                          {approval.text}
                        </StatusPill>
                      </span>
                    </th>
                    <td>
                      <SourceStateBadge evidence={row.evidence} />
                    </td>
                    <td>
                      <FactValue fact={row.pageTime} className="" />
                    </td>
                    <td>
                      <FactValue fact={row.readAt} className="" />
                    </td>
                    <td>
                      <FactValue fact={row.cadence} className="" />
                    </td>
                    <td>
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
        <ScreenSection title="Needs attention">
          <ul aria-label="Source notices" className="pp-stack">
            {model.notices.map((notice) => (
              <li key={notice.id}>
                <Card as="article" tone="muted">
                  <h3 className="pp-card__title">{notice.title}</h3>
                  <p className="pp-sub">{notice.body}</p>
                </Card>
              </li>
            ))}
          </ul>
        </ScreenSection>
      ) : null}
    </>
  );
}
