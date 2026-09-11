import { Share2 } from "lucide-react";
import { CommercialBaselineCard } from "@/components/paxpivot/CommercialBaselineCard";
import { EvidenceAge } from "@/components/paxpivot/EvidenceAge";
import { EvidenceRows } from "@/components/paxpivot/EvidenceRows";
import { HistoricalStats } from "@/components/paxpivot/HistoricalStats";
import { JourneyTimeline } from "@/components/paxpivot/JourneyTimeline";
import { MapSurface } from "@/components/paxpivot/MapSurface";
import { RouteHeadlinePill } from "@/components/paxpivot/RouteCard";
import { SourceStateBadge } from "@/components/paxpivot/SourceStateBadge";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, CardActions, CardHeader, Row, Rows } from "@/components/ui/Card";
import { StatGrid } from "@/components/ui/Facts";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Tabs } from "@/components/ui/Tabs";
import type { RouteDetailScreenModel } from "@/lib/presentation/screens/route-detail";

type Props = { model: RouteDetailScreenModel; initialTab?: string };

/**
 * One route in full: Overview, Evidence, Fallback and History. There is no Journey tab because
 * Overview already carries the complete timeline. Every value, label and ordering decision
 * arrives from the model; the screen evaluates nothing and stores nothing.
 */
export function RouteDetailScreen({ model, initialTab }: Props) {
  const header = (title: string) => (
    <AppHeader
      title={title}
      subtitle={model.status === "ready" ? model.subtitle : undefined}
      back={{ href: "/trips" }}
      actions={
        model.actions.shareHref ? (
          <IconButton
            href={model.actions.shareHref}
            label="Share this route"
            icon={<Share2 className="pp-i-lg" aria-hidden="true" />}
          />
        ) : undefined
      }
    />
  );

  if (model.status === "empty") {
    return (
      <>
        {header("Route detail")}
        <EmptyState
          title="No route to show yet"
          body="This route is not available yet, so there is nothing to describe."
          action={<Button href="/trips">See your trips</Button>}
        />
      </>
    );
  }

  if (model.status === "loading") {
    return (
      <>
        {header(model.title)}
        <LoadingState
          title={model.title}
          body="Loading this route's details."
        />
      </>
    );
  }

  if (model.status === "error") {
    return (
      <>
        {header(model.title)}
        <ErrorState
          title="We could not load this route"
          body="This is a failure on our side. The route itself is unchanged."
        />
      </>
    );
  }

  const overview = (
    <>
      <MapSurface map={model.map} />
      <StatGrid stats={model.stats} />
      <Card>
        <CardHeader>
          <RouteHeadlinePill headline={model.headline} />
        </CardHeader>
        <p className="pp-sub">{model.rankingReason}</p>
        {model.unresolved ? (
          <p className="pp-sub">
            <b>Unknown:</b> {model.unresolved}
          </p>
        ) : null}
      </Card>
      <JourneyTimeline legs={model.legs} />
      <StickyActionBar label="Route actions">
        {model.actions.watchHref ? (
          <Button href={model.actions.watchHref} variant="secondary">
            Watch
          </Button>
        ) : null}
        <Button href={model.actions.prepareHref}>Prepare for this route</Button>
      </StickyActionBar>
    </>
  );

  const evidence = (
    <>
      <Card>
        <CardHeader>
          <span className="pp-card__title">{model.evidence.sourceName}</span>
          <SourceStateBadge evidence={model.evidence.evidence} />
        </CardHeader>
        <EvidenceAge age={model.evidence.age} />
        <CardActions>
          <Button href={model.evidence.openHref} variant="secondary" size="sm">
            Open source
          </Button>
        </CardActions>
      </Card>
      <EvidenceRows rows={model.evidence.rows} />
      <p className="pp-meta">
        A record of what a page showed when we read it — not a reservation.
      </p>
      <Rows aria-label="Something wrong?">
        <Row title="Report this as wrong" href={model.evidence.reportHref} />
      </Rows>
    </>
  );

  const fallback = (
    <>
      {model.fallback.primary ? (
        <CommercialBaselineCard
          baseline={model.fallback.primary}
          headingLevel={2}
        />
      ) : null}
      {model.fallback.others.length > 0 ? (
        <section style={{ display: "grid", gap: "var(--space-3)" }}>
          <h2 className="pp-title">Other ways out</h2>
          <Rows aria-label="Other ways out">
            {model.fallback.others.map((other) => (
              <Row
                key={other.id}
                title={other.title}
                detail={other.detail}
                href={other.href}
              />
            ))}
          </Rows>
        </section>
      ) : null}
    </>
  );

  const history = <HistoricalStats history={model.history} />;

  return (
    <>
      {header(model.title)}
      <Tabs
        label="Route detail sections"
        defaultTab={initialTab}
        tabs={[
          { id: "overview", label: "Overview", panel: overview },
          { id: "evidence", label: "Evidence", panel: evidence },
          { id: "fallback", label: "Fallback", panel: fallback },
          { id: "history", label: "History", panel: history },
        ]}
      />
    </>
  );
}
