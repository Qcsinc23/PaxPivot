"use client";

import { Settings } from "lucide-react";
import { useState } from "react";
import { AlertList } from "@/components/paxpivot/AlertRow";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import {
  SegmentedControl,
  type SegmentOption,
} from "@/components/ui/SegmentedControl";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import type {
  AlertFilter,
  AlertsScreenModel,
} from "@/lib/presentation/screens/alerts";

/** The four filters the application can apply. The screen never filters the feed itself. */
const FILTER_OPTIONS: readonly SegmentOption<AlertFilter>[] = [
  { value: "all", label: "All" },
  { value: "route_order", label: "Routes" },
  { value: "source", label: "Sources" },
  { value: "readiness", label: "Readiness" },
];

type Props = { model: AlertsScreenModel };

/**
 * The alerts feed: one line, one time and one action per notification, plus why the email
 * version is deliberately non-specific. Ordering and filtering are the application's.
 */
export function AlertsScreen({ model }: Props) {
  const [filter, setFilter] = useState<AlertFilter>(model.filter);

  const header = (
    <AppHeader
      title="Alerts"
      actions={
        <IconButton
          href={model.settingsHref}
          label="Alert settings"
          icon={<Settings className="pp-i-lg" aria-hidden="true" />}
        />
      }
    />
  );

  if (model.status === "empty") {
    return (
      <>
        {header}
        <EmptyState
          title="Nothing to report"
          body="No alerts have been raised for your watched trips."
          action={
            <Button href={model.settingsHref}>Notification settings</Button>
          }
        />
      </>
    );
  }

  if (model.status === "loading") {
    return (
      <>
        {header}
        <LoadingState title="Alerts" body="Loading your alerts." />
      </>
    );
  }

  if (model.status === "error") {
    return (
      <>
        {header}
        <ErrorState
          title="We could not load your alerts"
          body="This is a failure on our side, not a statement that nothing has changed."
        />
      </>
    );
  }

  return (
    <>
      {header}

      <Card as="div">
        <span className="pp-label">Show</span>
        <SegmentedControl
          label="Alert types"
          value={filter}
          options={FILTER_OPTIONS}
          onChange={setFilter}
        />
      </Card>

      {model.alerts.length > 0 ? (
        <AlertList alerts={model.alerts} />
      ) : (
        <p className="pp-sub">No alerts of this kind right now.</p>
      )}

      <Card tone="muted">
        <h2 className="pp-title">{model.emailNote.title}</h2>
        <Disclosure summary="Read the note">
          <p>{model.emailNote.body}</p>
        </Disclosure>
      </Card>
    </>
  );
}
