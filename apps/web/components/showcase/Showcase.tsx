"use client";

import { Bell, Bookmark } from "lucide-react";
import { useState } from "react";
import { AlertList } from "@/components/paxpivot/AlertRow";
import { CommercialBaselineCard } from "@/components/paxpivot/CommercialBaselineCard";
import { EvidenceAge } from "@/components/paxpivot/EvidenceAge";
import { EvidenceRows } from "@/components/paxpivot/EvidenceRows";
import { HistoricalStats } from "@/components/paxpivot/HistoricalStats";
import { JourneyTimeline } from "@/components/paxpivot/JourneyTimeline";
import { MapSurface } from "@/components/paxpivot/MapSurface";
import { ReadinessList } from "@/components/paxpivot/ReadinessItem";
import { RouteCard } from "@/components/paxpivot/RouteCard";
import { SourceLedger } from "@/components/paxpivot/SourceLedger";
import {
  SourceStateBadge,
  SourceStateDisclosure,
} from "@/components/paxpivot/SourceStateBadge";
import { TerminalCard } from "@/components/paxpivot/TerminalCard";
import { TripCard } from "@/components/paxpivot/TripCard";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { StatGrid } from "@/components/ui/Facts";
import { StatusPill } from "@/components/ui/Pill";
import { Progress } from "@/components/ui/Progress";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Tabs } from "@/components/ui/Tabs";
import { known, unknown } from "@/lib/presentation/fact";
import {
  fixtureAlerts,
  fixtureCandidate,
  fixtureCommercial,
  fixtureEvidenceAge,
  fixtureEvidenceAgeUnknownSource,
  fixtureEvidenceRows,
  fixtureHistory,
  fixtureHistoryUnknown,
  fixtureLedger,
  fixtureLegs,
  fixtureMap,
  fixtureReadiness,
  fixtureRoute,
  fixtureTerminal,
  fixtureTerminalUnverified,
  fixtureTrip,
} from "@/lib/presentation/fixtures";
import { SOURCE_STATE_CODES } from "@/lib/presentation/source-state";
import { SORT_OPTIONS, type RankingSortMode } from "@/lib/presentation/types";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      style={{ display: "grid", gap: "var(--space-3)" }}
    >
      <h2 id={`${id}-h`} className="pp-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Every foundation component driven by synthetic fixtures. Development only. */
export function Showcase() {
  const [sort, setSort] = useState<RankingSortMode>("recommended");
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <AppHeader
        title="UI foundation showcase"
        subtitle="Synthetic fixtures · not real terminals, fares or travelers"
        back={{ href: "/" }}
        actions={
          <>
            <IconButton
              label="Watch"
              icon={<Bookmark className="pp-i-lg" aria-hidden="true" />}
            />
            <IconButton
              label="Alerts"
              icon={<Bell className="pp-i-lg" aria-hidden="true" />}
            />
          </>
        }
      />

      <Section id="controls" title="Controls">
        <SegmentedControl
          label="Sort routes"
          value={sort}
          options={SORT_OPTIONS}
          onChange={setSort}
        />
        <div className="pp-card__actions">
          <Button>Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Open sheet
          </Button>
        </div>
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Why this order"
        >
          <p className="pp-sub">
            Compared one field at a time, stopping at the first difference.
          </p>
          <p className="pp-meta">
            No weighted score, no boarding model. Unknown time or cost never
            counts as zero.
          </p>
        </Sheet>
        <Progress label="Sources checked" value={4} max={7} />
        <Disclosure summary="Why?">
          <p>
            Progressive disclosure keeps methodology one tap away instead of on
            the surface.
          </p>
        </Disclosure>
      </Section>

      <Section id="states" title="Source states">
        <div className="pp-card__hd">
          {SOURCE_STATE_CODES.map((code) => (
            <SourceStateBadge key={code} evidence={{ state: code }} />
          ))}
        </div>
        <div className="pp-card__hd">
          <StatusPill tone="best">Safest overall</StatusPill>
          <StatusPill tone="space-a">Best Space-A</StatusPill>
          <StatusPill tone="ghost">Option 3</StatusPill>
        </div>
        <SourceStateDisclosure evidence={fixtureRoute.evidence} />
        <SourceLedger rows={fixtureLedger} />
      </Section>

      <Section id="results" title="Results">
        <CommercialBaselineCard baseline={fixtureCommercial} />
        <RouteCard route={fixtureRoute} />
        <RouteCard route={fixtureCandidate} />
      </Section>

      <Section id="route" title="Route detail">
        <MapSurface map={fixtureMap} />
        <StatGrid
          stats={[
            { label: "Known cost", value: fixtureRoute.knownCost },
            { label: "Handoffs", value: known("2") },
            { label: "Space-A leg", value: known("1") },
            { label: "Evidence age", value: unknown("No read time") },
          ]}
        />
        <Tabs
          label="Route detail sections"
          tabs={[
            {
              id: "overview",
              label: "Overview",
              panel: <JourneyTimeline legs={fixtureLegs} />,
            },
            {
              id: "evidence",
              label: "Evidence",
              panel: (
                <Card>
                  <CardHeader>
                    <span className="pp-card__title">
                      Official terminal page
                    </span>
                  </CardHeader>
                  <EvidenceAge age={fixtureEvidenceAge} />
                  <EvidenceAge age={fixtureEvidenceAgeUnknownSource} />
                  <EvidenceRows rows={fixtureEvidenceRows} />
                </Card>
              ),
            },
            {
              id: "fallback",
              label: "Fallback",
              panel: (
                <CommercialBaselineCard
                  baseline={{ ...fixtureCommercial, headline: "fallback" }}
                />
              ),
            },
            {
              id: "history",
              label: "History",
              panel: (
                <>
                  <HistoricalStats history={fixtureHistory} />
                  <HistoricalStats history={fixtureHistoryUnknown} />
                </>
              ),
            },
          ]}
        />
        <StickyActionBar label="Route actions">
          <Button variant="secondary" size="sm">
            Watch
          </Button>
          <Button>Prepare for this route</Button>
        </StickyActionBar>
      </Section>

      <Section id="terminals" title="Terminals">
        <TerminalCard terminal={fixtureTerminal} />
        <TerminalCard terminal={fixtureTerminalUnverified} />
      </Section>

      <Section id="trips" title="Trips, alerts, readiness">
        <TripCard trip={fixtureTrip} />
        <Card>
          <AlertList alerts={fixtureAlerts} />
        </Card>
        <Card>
          <ReadinessList items={fixtureReadiness} />
        </Card>
      </Section>

      <Section id="empty" title="Empty, loading, error">
        <EmptyState
          title="Nothing planned yet"
          body="Tell us where you want to be."
          action={<Button>Plan a trip</Button>}
        />
        <LoadingState
          title="Checking sources"
          body="Previous result stays on screen, marked stale."
        />
        <ErrorState
          title="We could not check this source"
          body="A failure on our side; it says nothing about departures."
        />
      </Section>
    </>
  );
}
