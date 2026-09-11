"use client";

import { useId, useState } from "react";
import { HistoricalStats } from "@/components/paxpivot/HistoricalStats";
import { MapSurface } from "@/components/paxpivot/MapSurface";
import { TerminalCard } from "@/components/paxpivot/TerminalCard";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardEnd } from "@/components/ui/Card";
import { FactStrip } from "@/components/ui/Facts";
import { StatusPill } from "@/components/ui/Pill";
import {
  SegmentedControl,
  type SegmentOption,
} from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { factText } from "@/lib/presentation/fact";
import type { TerminalNetworkScreenModel } from "@/lib/presentation/screens/terminals";

type Filter = Exclude<TerminalNetworkScreenModel["filter"], "all">;

/** The two filters the application can apply. The screen never filters the list itself. */
const FILTER_OPTIONS: readonly SegmentOption<Filter>[] = [
  { value: "reachable", label: "Reachable" },
  { value: "excluded", label: "Excluded" },
];

type Props = { model: TerminalNetworkScreenModel };

/**
 * The terminal network: reachable and excluded counts, a map whose marker list is always
 * rendered, the filtered terminal cards, and a sheet for the terminal the application selected.
 * Filtering, travel time and inclusion are the application's; the screen only reports them.
 */
export function TerminalNetworkScreen({ model }: Props) {
  const [filter, setFilter] = useState<Filter>(
    model.filter === "all" ? "reachable" : model.filter,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const listHeadingId = useId();

  const header = (
    <AppHeader
      title="Terminals"
      subtitle={
        model.filter === "all" ? "Supported network" : "By travel time from you"
      }
      back={{ href: "/" }}
    />
  );

  if (model.status === "empty") {
    return (
      <>
        {header}
        <EmptyState
          title="No terminals yet"
          body="Terminal travel times are not available yet, so there is no network to show."
          action={<Button href="/">Plan a trip</Button>}
        />
      </>
    );
  }

  if (model.status === "loading") {
    return (
      <>
        {header}
        <LoadingState title="Terminals" body="Loading terminal travel times." />
      </>
    );
  }

  if (model.status === "error") {
    return (
      <>
        {header}
        <ErrorState
          title="We could not load the terminal network"
          body="This is a failure on our side, not a statement about which terminals are usable."
        />
      </>
    );
  }

  const { selected } = model;

  return (
    <>
      {header}

      <MapSurface map={model.map} size="hero" />

      {model.filter === "all" ? (
        <p className="pp-meta">
          Travel time from you is not computed until you plan a trip.
        </p>
      ) : (
        <>
          <div className="pp-card__hd">
            <StatusPill tone="verified">
              Reachable {factText(model.summary.reachable)}
            </StatusPill>
            <StatusPill tone="ghost">
              Excluded {factText(model.summary.excluded)}
            </StatusPill>
          </div>

          <Card as="div">
            <span className="pp-label">Show</span>
            <SegmentedControl
              label="Terminals to show"
              value={filter}
              options={FILTER_OPTIONS}
              onChange={setFilter}
            />
          </Card>
        </>
      )}

      {selected ? (
        <Card as="div" tone="flat">
          <div className="pp-card__hd">
            <span className="pp-fact__l">Selected terminal</span>
            <span className="pp-row__title">{selected.terminal.name}</span>
            <CardEnd>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSheetOpen(true)}
              >
                Details
              </Button>
            </CardEnd>
          </div>
        </Card>
      ) : null}

      {model.terminals.length > 0 ? (
        <section
          aria-labelledby={listHeadingId}
          style={{ display: "grid", gap: "var(--space-3)" }}
        >
          {/*
            Named from the model's filter, not the local chip: only the application can change
            which terminals the list actually holds.
          */}
          <h2 id={listHeadingId} className="pp-title">
            {model.filter === "excluded"
              ? "Excluded terminals"
              : model.filter === "all"
                ? "Supported terminals"
                : "Reachable terminals"}
          </h2>
          <ul
            aria-label="Terminals"
            style={{ display: "grid", gap: "var(--space-3)" }}
          >
            {model.terminals.map((terminal) => (
              <li key={terminal.id}>
                <TerminalCard terminal={terminal} headingLevel={3} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {selected ? (
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={selected.terminal.name}
        >
          <FactStrip facts={selected.facts} />
          <p className="pp-sub">{selected.ruleText}</p>
          <HistoricalStats history={selected.history} />
        </Sheet>
      ) : null}
    </>
  );
}
