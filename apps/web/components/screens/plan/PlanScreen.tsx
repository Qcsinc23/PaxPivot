"use client";

import { Settings } from "lucide-react";
import { useState } from "react";
import { SourceStateBadge } from "@/components/paxpivot/SourceStateBadge";
import { TripCard } from "@/components/paxpivot/TripCard";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, CardHeader, Row, Rows } from "@/components/ui/Card";
import { FactValue } from "@/components/ui/Facts";
import { StatusPill } from "@/components/ui/Pill";
import { ScreenSection } from "@/components/ui/ScreenSection";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import {
  ELIGIBILITY_WORDING,
  eligibilitySummaryText,
} from "@/lib/presentation/eligibility";
import type { PlanScreenModel } from "@/lib/presentation/screens/plan";
import { SORT_OPTIONS, type RankingSortMode } from "@/lib/presentation/types";
import { TripSettingsSheet } from "./TripSettingsSheet";

type Props = { model: PlanScreenModel };

/**
 * Plan home. Pure composition of the UI foundation: it renders the screen model and makes no
 * eligibility, distance, freshness or ordering decision.
 */
export function PlanScreen({ model }: Props) {
  const [sort, setSort] = useState<RankingSortMode>(model.sort);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (model.status === "empty") {
    return (
      <>
        <AppHeader title="Plan" />
        <EmptyState
          title="Nothing planned yet"
          body="Journey planning is not available yet."
          action={
            <Button href="/trips" block>
              Find routes
            </Button>
          }
        />
      </>
    );
  }

  if (model.status === "loading") {
    return (
      <>
        <AppHeader title="Plan" />
        {model.sourcesUpdated ? (
          <p className="pp-meta">
            Last known sources{" "}
            <SourceStateBadge evidence={model.sourcesUpdated} />
          </p>
        ) : null}
        <LoadingState
          title="Plan"
          body="Loading your trip request and the last known source states."
        />
      </>
    );
  }

  if (model.status === "error") {
    return (
      <>
        <AppHeader title="Plan" />
        <ErrorState
          title="We could not load your plan"
          body="This is a failure on our side, not a statement about what is flying. Nothing in your plan has changed."
        />
      </>
    );
  }

  const { eligibility } = model;
  const lexeme = eligibility
    ? ELIGIBILITY_WORDING[eligibility.state]
    : undefined;

  return (
    <>
      <AppHeader
        title="Plan"
        actions={
          <IconButton
            label="Trip settings"
            icon={<Settings className="pp-i-lg" aria-hidden="true" />}
            onClick={() => setSettingsOpen(true)}
          />
        }
      />

      <Card>
        <CardHeader>
          {eligibility && lexeme ? (
            <StatusPill tone={lexeme.tone} srText={lexeme.srText}>
              {eligibilitySummaryText(eligibility)}
            </StatusPill>
          ) : null}
        </CardHeader>
        <h2 className="pp-serif">Where to?</h2>
        {model.destinationQuery ? (
          <p className="pp-title">{model.destinationQuery}</p>
        ) : null}
        <dl className="pp-facts">
          <div className="pp-fact">
            <dt className="pp-fact__l">From</dt>
            <dd>
              <FactValue fact={model.origin} />
            </dd>
          </div>
          {model.window ? (
            <div className="pp-fact">
              <dt className="pp-fact__l">Window</dt>
              <dd>
                <FactValue fact={model.window} />
              </dd>
            </div>
          ) : null}
          {model.partyText ? (
            <div className="pp-fact">
              <dt className="pp-fact__l">Party</dt>
              <dd>
                <span className="pp-fact__n">{model.partyText}</span>
              </dd>
            </div>
          ) : null}
        </dl>
        <Button href="/trips" block>
          Find routes
        </Button>
      </Card>

      {model.sourcesUpdated ? (
        <p className="pp-meta">
          Sources updated <SourceStateBadge evidence={model.sourcesUpdated} />
        </p>
      ) : null}

      <Card as="div">
        <span className="pp-label">Sort</span>
        <SegmentedControl
          label="Sort routes"
          value={sort}
          options={SORT_OPTIONS}
          onChange={setSort}
        />
      </Card>

      {model.watching.length > 0 ? (
        <ScreenSection title="Watching">
          <ul aria-label="Watched trips" className="pp-stack">
            {model.watching.map((trip) => (
              <li key={trip.id}>
                <TripCard trip={trip} />
              </li>
            ))}
          </ul>
        </ScreenSection>
      ) : null}

      {model.nearbyTerminals.length > 0 ? (
        <ScreenSection title="Nearby terminals">
          <Rows aria-label="Nearby terminals">
            {model.nearbyTerminals.map((terminal) => (
              <Row
                key={terminal.id}
                title={terminal.name}
                detail={<FactValue fact={terminal.accessText} />}
                end={<SourceStateBadge evidence={terminal.evidence} />}
                href={terminal.href}
              />
            ))}
          </Rows>
        </ScreenSection>
      ) : null}

      <TripSettingsSheet
        model={model.settings}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
