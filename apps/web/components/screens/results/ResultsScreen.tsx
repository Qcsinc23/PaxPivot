"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { CommercialBaselineCard } from "@/components/paxpivot/CommercialBaselineCard";
import { MapSurface } from "@/components/paxpivot/MapSurface";
import { ConflictNotice } from "@/components/paxpivot/notices/ConflictNotice";
import { HonestAbsencePanel } from "@/components/paxpivot/notices/HonestAbsencePanel";
import { KeptResultNotice } from "@/components/paxpivot/notices/KeptResultNotice";
import { LateCheckNotice } from "@/components/paxpivot/notices/LateCheckNotice";
import { NotRankedNotice } from "@/components/paxpivot/notices/NotRankedNotice";
import { RefreshNotice } from "@/components/paxpivot/notices/RefreshNotice";
import { RouteCard } from "@/components/paxpivot/RouteCard";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, CardEnd } from "@/components/ui/Card";
import {
  SegmentedControl,
  type SegmentOption,
} from "@/components/ui/SegmentedControl";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import type { ResultsScreenModel } from "@/lib/presentation/screens/results";
import {
  SORT_MODE_LABELS,
  type RankingSortMode,
} from "@/lib/presentation/types";
import { WhyOrderSheet } from "./WhyOrderSheet";

/** Sort options come from the foundation's labels; the screen never invents its own wording. */
const SORT_OPTIONS: readonly SegmentOption<RankingSortMode>[] = (
  Object.keys(SORT_MODE_LABELS) as RankingSortMode[]
).map((value) => ({ value, label: SORT_MODE_LABELS[value] }));

type Props = { model: ResultsScreenModel };

/** Vertical rhythm between a section heading and its list, using foundation tokens only. */
function ScreenSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      style={{ display: "grid", gap: "var(--space-3)" }}
    >
      <h2 id={id} className="pp-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Ranked results for one trip. Pure composition: the route list, the commercial baseline and
 * every notice arrive ordered and labelled by the application. The screen never sorts, filters,
 * re-labels or re-ranks, and it never turns a failed check into an absence of routes.
 */
export function ResultsScreen({ model }: Props) {
  const [sort, setSort] = useState<RankingSortMode>(model.sort);
  const [whyOpen, setWhyOpen] = useState(false);

  const notices = (
    <>
      {model.kept ? <KeptResultNotice notice={model.kept} /> : null}
      {model.refresh ? <RefreshNotice notice={model.refresh} /> : null}
      {model.lateChecks.map((notice, index) => (
        <LateCheckNotice key={`late-${index}`} notice={notice} />
      ))}
      {model.conflicts.map((notice, index) => (
        <ConflictNotice key={`conflict-${index}`} notice={notice} />
      ))}
    </>
  );

  const header = (
    <AppHeader
      title={model.title}
      subtitle={model.subtitle}
      back={{ href: "/trips" }}
      actions={
        <IconButton
          label="Filters"
          icon={<SlidersHorizontal className="pp-i-lg" aria-hidden="true" />}
        />
      }
    />
  );

  const whySheet = (
    <WhyOrderSheet
      model={model.whyOrder}
      open={whyOpen}
      onClose={() => setWhyOpen(false)}
    />
  );

  if (model.status === "loading") {
    return (
      <>
        {header}
        {model.kept ? <KeptResultNotice notice={model.kept} /> : null}
        <LoadingState
          title="Finding routes"
          body="Checking the sources for this trip; the last result stays on screen until this finishes."
        />
      </>
    );
  }

  if (model.status === "error") {
    return (
      <>
        {header}
        <ErrorState
          title="We could not load routes for this trip"
          body="This is a failure on our side, not a statement about what is flying. Nothing has been ruled out."
        />
      </>
    );
  }

  if (model.status === "no_route") {
    return (
      <>
        {header}
        {notices}
        {model.absence ? (
          <HonestAbsencePanel absence={model.absence} headingLevel={2} />
        ) : (
          <EmptyState
            title="Nothing to show yet"
            body="This trip has no route search yet."
          />
        )}
        {whySheet}
      </>
    );
  }

  return (
    <>
      {header}

      <MapSurface map={model.map} />

      {notices}

      <Card as="div">
        <div className="pp-card__hd">
          <span className="pp-label">Sort</span>
          <CardEnd>
            <Button variant="ghost" size="sm" onClick={() => setWhyOpen(true)}>
              Why this order
            </Button>
          </CardEnd>
        </div>
        <SegmentedControl
          label="Sort routes"
          value={sort}
          options={SORT_OPTIONS}
          onChange={setSort}
        />
      </Card>

      {model.baseline ? (
        <CommercialBaselineCard baseline={model.baseline} headingLevel={2} />
      ) : null}

      {model.routes.length > 0 ? (
        <ScreenSection title="Space-A routes">
          <ul style={{ display: "grid", gap: "var(--space-3)" }}>
            {model.routes.map((route) => (
              <li key={route.id}>
                <RouteCard route={route} headingLevel={3} />
              </li>
            ))}
          </ul>
        </ScreenSection>
      ) : null}

      {model.notRanked ? <NotRankedNotice notice={model.notRanked} /> : null}

      <div className="pp-inline-actions">
        <Button href={model.compareHref} variant="secondary">
          Compare all
        </Button>
      </div>

      {whySheet}
    </>
  );
}
