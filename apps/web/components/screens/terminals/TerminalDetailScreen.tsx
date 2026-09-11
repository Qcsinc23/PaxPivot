import { Navigation } from "lucide-react";
import { EvidenceAge } from "@/components/paxpivot/EvidenceAge";
import { EvidenceRows } from "@/components/paxpivot/EvidenceRows";
import { HandoffLabel } from "@/components/paxpivot/Handoff";
import { HistoricalStats } from "@/components/paxpivot/HistoricalStats";
import { MapSurface } from "@/components/paxpivot/MapSurface";
import { SourceStateBadge } from "@/components/paxpivot/SourceStateBadge";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardActions, Row, Rows } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { FactValue, StatGrid } from "@/components/ui/Facts";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import type { TerminalDetailScreenModel } from "@/lib/presentation/screens/terminals";

type Props = { model: TerminalDetailScreenModel; initialTab?: string };

/**
 * One terminal in full. Entrance status, hours, opportunity counts, parking, travel options and
 * history all arrive from the model; a withdrawn or superseded opportunity keeps the state it
 * was given rather than being shown as current.
 */
export function TerminalDetailScreen({ model, initialTab }: Props) {
  const header = (title: string, badge: boolean) => (
    <AppHeader
      title={title}
      back={{ href: "/terminals" }}
      actions={
        badge ? (
          <SourceStateBadge evidence={model.terminal.evidence} />
        ) : undefined
      }
    />
  );

  if (model.status === "empty") {
    return (
      <>
        {header("Terminal", false)}
        <EmptyState
          title="No terminal to show yet"
          body="Terminal details are not available yet, so there is nothing to describe."
          action={<Button href="/terminals">See terminals</Button>}
        />
      </>
    );
  }

  if (model.status === "loading") {
    return (
      <>
        {header("Terminal", false)}
        <LoadingState title="Terminal" body="Loading this terminal." />
      </>
    );
  }

  if (model.status === "error") {
    return (
      <>
        {header("Terminal", false)}
        <ErrorState
          title="We could not load this terminal"
          body="This is a failure on our side, not a statement about this terminal."
        />
      </>
    );
  }

  const { terminal } = model;

  const overview = (
    <>
      {model.opportunities.length > 0 ? (
        <Rows aria-label="Published opportunities">
          {model.opportunities.map((opportunity) => (
            <Row
              key={opportunity.id}
              title={opportunity.title}
              detail={opportunity.detail}
              end={<SourceStateBadge evidence={opportunity.evidence} />}
            />
          ))}
        </Rows>
      ) : (
        // Model-supplied wording: a terminal whose check failed, or which was never checked,
        // must never be described as publishing no opportunities.
        <p className="pp-sub">{model.opportunitiesNote}</p>
      )}
      <p className="pp-meta">
        A published opportunity is not a reservation or a guaranteed seat.
      </p>
    </>
  );

  const travel = (
    <>
      <EvidenceRows rows={model.travel.rows} label="Travel options" />
      {model.travel.handoffs.length > 0 ? (
        <Rows aria-label="Provider handoffs">
          {model.travel.handoffs.map((handoff) => (
            <Row
              key={handoff.id}
              title={handoff.title}
              detail={
                <>
                  {handoff.detail} · <HandoffLabel kind={handoff.unknown} />
                </>
              }
              href={handoff.href}
            />
          ))}
        </Rows>
      ) : null}
    </>
  );

  const evidence = (
    <>
      <Card>
        {model.evidence.age ? (
          <EvidenceAge age={model.evidence.age} />
        ) : (
          <p className="pp-sub">
            PaxPivot has not read a source for this terminal yet.
          </p>
        )}
        <EvidenceRows rows={model.evidence.rows} />
      </Card>
      <Disclosure summary="Why included or excluded?">
        <p>{model.evidence.whyIncluded}</p>
      </Disclosure>
    </>
  );

  const history = <HistoricalStats history={model.history} />;

  return (
    <>
      {header(terminal.name, true)}

      <MapSurface map={model.map} size="hero" />

      <p className="pp-meta">
        {terminal.installation ? `${terminal.installation} · ` : null}
        From you <FactValue fact={terminal.accessText} className="" />
      </p>

      <Card as="div">
        {model.actions.directionsHref ? (
          <div className="pp-card__hd">
            <Button
              href={model.actions.directionsHref}
              variant="secondary"
              size="sm"
              icon={<Navigation className="pp-i" aria-hidden="true" />}
            >
              Directions
            </Button>
            <HandoffLabel />
          </div>
        ) : (
          <p className="pp-sub">
            Directions need a verified passenger entrance, which is not on
            record yet.
          </p>
        )}
        <CardActions>
          {model.actions.watchHref ? (
            <Button
              href={model.actions.watchHref}
              variant="secondary"
              size="sm"
            >
              Watch
            </Button>
          ) : null}
          {model.actions.officialHref ? (
            <Button href={model.actions.officialHref} variant="ghost" size="sm">
              Official page
            </Button>
          ) : null}
        </CardActions>
      </Card>

      <StatGrid stats={model.stats} />

      <Tabs
        label="Terminal sections"
        defaultTab={initialTab}
        tabs={[
          { id: "overview", label: "Overview", panel: overview },
          { id: "travel", label: "Travel", panel: travel },
          { id: "evidence", label: "Evidence", panel: evidence },
          { id: "history", label: "History", panel: history },
        ]}
      />

      {model.compareHref ? (
        <Rows aria-label="Nearby">
          <Row title="Compare nearby terminals" href={model.compareHref} />
        </Rows>
      ) : null}
    </>
  );
}
