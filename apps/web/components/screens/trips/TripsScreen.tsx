"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { TripCard } from "@/components/paxpivot/TripCard";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  SegmentedControl,
  type SegmentOption,
} from "@/components/ui/SegmentedControl";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import type {
  JourneyStatusValue,
  TripsScreenModel,
} from "@/lib/presentation/screens/trips";

/** The four states a traveler can confirm. Nothing else may set them. */
const JOURNEY_OPTIONS: readonly SegmentOption<JourneyStatusValue>[] = [
  { value: "not_started", label: "Not started" },
  { value: "travelling", label: "Travelling" },
  { value: "arrived", label: "Arrived" },
  { value: "did_not_board", label: "Didn't get on" },
];

type Props = { model: TripsScreenModel };

/**
 * Watched trips with their own source summaries, plus the traveler-confirmed journey status.
 * The shelf order, the source pills and the journey value are the application's; nothing here
 * infers progress from location, schedules or aircraft data.
 */
export function TripsScreen({ model }: Props) {
  const [journeyStatus, setJourneyStatus] = useState<JourneyStatusValue>(
    model.journeyStatus.value,
  );

  const header = (
    <AppHeader
      title="Trips"
      actions={
        <IconButton
          href={model.newTripHref}
          label="New trip"
          icon={<Plus className="pp-i-lg" aria-hidden="true" />}
        />
      }
    />
  );

  if (model.status === "empty") {
    return (
      <>
        {header}
        <EmptyState
          title="No trips yet"
          body="Watch a route and it will appear here with what we checked."
          action={<Button href={model.newTripHref}>Plan a trip</Button>}
        />
      </>
    );
  }

  if (model.status === "loading") {
    return (
      <>
        {header}
        <LoadingState title="Trips" body="Loading your watched trips." />
      </>
    );
  }

  if (model.status === "error") {
    return (
      <>
        {header}
        <ErrorState
          title="We could not load your trips"
          body="This is a failure on our side. Your watched trips are unchanged."
        />
      </>
    );
  }

  return (
    <>
      {header}

      <Card as="div">
        <h2 className="pp-title">Where are you now?</h2>
        <SegmentedControl
          label="Your journey status"
          value={journeyStatus}
          options={JOURNEY_OPTIONS}
          onChange={setJourneyStatus}
        />
        <p className="pp-meta">{model.journeyStatus.note}</p>
      </Card>

      {model.trips.length > 0 ? (
        <section
          aria-label="Watched trips"
          style={{ display: "grid", gap: "var(--space-3)" }}
        >
          <ul style={{ display: "grid", gap: "var(--space-3)" }}>
            {model.trips.map((trip) => (
              <li key={trip.id}>
                <TripCard trip={trip} headingLevel={3} />
                {trip.top ? null : (
                  <p className="pp-inline-actions">
                    <Button href={trip.href} variant="ghost" size="sm">
                      See what was checked
                    </Button>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
