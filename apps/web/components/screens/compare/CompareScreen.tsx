import Link from "next/link";
import { RouteHeadlinePill } from "@/components/paxpivot/RouteCard";
import { SourceStateBadge } from "@/components/paxpivot/SourceStateBadge";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FactValue } from "@/components/ui/Facts";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import type { CompareScreenModel } from "@/lib/presentation/screens/compare";

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
        <div className="pp-table-wrap">
          <table className="pp-table">
            <caption>{model.title}</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Field</span>
                </th>
                {model.options.map((option) => (
                  <th key={option.id} scope="col">
                    {option.headline === "safest_overall" ? (
                      <StatusPill tone="best">Safest overall</StatusPill>
                    ) : (
                      <RouteHeadlinePill headline={option.headline} />
                    )}
                    <Link href={option.href} className="pp-table__title">
                      {option.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  {row.cells.map((cell, index) => (
                    <td
                      key={`${row.id}-${index}`}
                      data-emphasis={
                        cell.emphasis === "none" ? undefined : cell.emphasis
                      }
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
