import Link from "next/link";
import type { CSSProperties } from "react";
import { RouteHeadlinePill } from "@/components/paxpivot/RouteCard";
import { SourceStateBadge } from "@/components/paxpivot/SourceStateBadge";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FactValue } from "@/components/ui/Facts";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import type {
  CompareEmphasis,
  CompareScreenModel,
} from "@/lib/presentation/screens/compare";

/*
 * Table styling lives here as token-valued inline styles: this task owns no stylesheet, and
 * adding a class to the foundation's components.css would be a shared-contract change. The
 * rem-based minimum keeps the columns readable and lets the wrapper scroll on narrow screens
 * rather than squeezing the fields into unreadable columns.
 */
const TABLE: CSSProperties = {
  width: "100%",
  minWidth: "32rem",
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

const OPTION_TITLE: CSSProperties = {
  display: "block",
  marginTop: "var(--space-1)",
  fontWeight: 600,
};

/**
 * Only the application's `emphasis` is expressed. "better" is bold, "tie" is muted but stays at
 * full opacity and above 4.5:1; the cell text always carries the value on its own. The screen
 * never promotes or demotes a cell — least of all one whose value is unknown.
 */
function emphasisStyle(emphasis: CompareEmphasis): CSSProperties {
  if (emphasis === "better") return { fontWeight: 700 };
  if (emphasis === "tie") return { color: "var(--color-neutral-700)" };
  return {};
}

type Props = { model: CompareScreenModel };

/**
 * Side-by-side comparison of the options the application already ordered. Every cell, its
 * emphasis and the trade-off line arrive from the model; nothing is compared in the browser.
 */
export function CompareScreen({ model }: Props) {
  if (model.status === "empty") {
    return (
      <>
        <AppHeader title="Compare routes" back={{ href: "/trips" }} />
        <EmptyState
          title="Nothing to compare yet"
          body="Routes for this trip are not available yet, so there is nothing to put side by side."
          action={<Button href={model.actions.openHref}>See your trips</Button>}
        />
      </>
    );
  }

  if (model.status === "loading") {
    return (
      <>
        <AppHeader title="Compare routes" back={{ href: "/trips" }} />
        <LoadingState
          title="Compare routes"
          body="Loading the options for this trip."
        />
      </>
    );
  }

  if (model.status === "error") {
    return (
      <>
        <AppHeader title="Compare routes" back={{ href: "/trips" }} />
        <ErrorState
          title="We could not load the comparison"
          body="This is a failure on our side. The options themselves are unchanged."
        />
      </>
    );
  }

  return (
    <>
      <AppHeader title="Compare routes" back={{ href: "/trips" }} />

      <Card as="div">
        {/*
          `contain: paint` keeps the table's scrollable overflow inside this box. Without it the
          engine still folds part of the overflowing table into the document's scroll width, so
          the page itself slides sideways on a narrow screen.
        */}
        <div style={{ overflowX: "auto", contain: "paint" }}>
          <table style={TABLE}>
            <caption style={CAPTION}>{model.title}</caption>
            <thead>
              <tr>
                <th scope="col" style={CELL}>
                  <span className="sr-only">Field</span>
                </th>
                {model.options.map((option) => (
                  <th key={option.id} scope="col" style={CELL}>
                    {option.headline === "safest_overall" ? (
                      <StatusPill tone="best">Safest overall</StatusPill>
                    ) : (
                      <RouteHeadlinePill headline={option.headline} />
                    )}
                    <Link href={option.href} style={OPTION_TITLE}>
                      {option.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" style={{ ...CELL, fontWeight: 600 }}>
                    {row.label}
                  </th>
                  {row.cells.map((cell, index) => (
                    <td
                      key={`${row.id}-${index}`}
                      style={{ ...CELL, ...emphasisStyle(cell.emphasis) }}
                    >
                      <FactValue fact={cell.value} className="" />
                      {cell.evidence ? (
                        <>
                          {" "}
                          <SourceStateBadge evidence={cell.evidence} />
                        </>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {model.trade ? (
        <Card tone="muted">
          <h2 className="pp-title">The trade</h2>
          <p className="pp-sub">{model.trade}</p>
        </Card>
      ) : null}

      {model.decidedBy ? (
        <p className="pp-meta">Decided by {model.decidedBy}</p>
      ) : null}

      <StickyActionBar label="Comparison actions">
        {model.actions.watchAllHref ? (
          <Button href={model.actions.watchAllHref} variant="secondary">
            Watch both
          </Button>
        ) : null}
        <Button href={model.actions.openHref}>Open</Button>
      </StickyActionBar>
    </>
  );
}
