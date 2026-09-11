"use client";

import { Search, Sparkles } from "lucide-react";
import { useState, useId } from "react";
import { MapSurface } from "@/components/paxpivot/MapSurface";
import { RouteCard } from "@/components/paxpivot/RouteCard";
import { SplitLayout } from "@/components/screens/desktop/SplitLayout";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import {
  SegmentedControl,
  type SegmentOption,
} from "@/components/ui/SegmentedControl";
import { ASK_HREF } from "@/lib/presentation/navigation";
import { fixtureResults } from "@/lib/presentation/screens/results";
import {
  SORT_MODE_LABELS,
  type RankingSortMode,
} from "@/lib/presentation/types";

const SORT_OPTIONS: readonly SegmentOption<RankingSortMode>[] = (
  Object.keys(SORT_MODE_LABELS) as RankingSortMode[]
).map((value) => ({ value, label: SORT_MODE_LABELS[value] }));

/**
 * Development-only desktop composition: the realistic wide-viewport arrangement of Results —
 * a top bar with the search affordance, the sort chips and the Ask action, then the route list
 * beside the map. The full Results screen renders its own map, so this composition demonstrates
 * `SplitLayout` over the same results fixture rather than nesting one inside the other.
 */
export default function ShowcaseDesktopCompositionPage() {
  const [sort, setSort] = useState<RankingSortMode>(fixtureResults.sort);
  const listHeadingId = useId();

  return (
    <>
      <AppHeader
        title="Desktop composition"
        subtitle="Synthetic fixture · list beside map"
        back={{ href: "/" }}
      />

      <div className="pp-topbar">
        <Button
          href="/"
          variant="secondary"
          size="sm"
          icon={<Search className="pp-i" aria-hidden="true" />}
        >
          Where to?
        </Button>
        <SegmentedControl
          label="Sort routes"
          value={sort}
          options={SORT_OPTIONS}
          onChange={setSort}
        />
        <Button
          href={ASK_HREF}
          variant="secondary"
          size="sm"
          icon={<Sparkles className="pp-i" aria-hidden="true" />}
        >
          Ask
        </Button>
      </div>

      <SplitLayout
        list={
          <section
            aria-labelledby={listHeadingId}
            style={{ display: "grid", gap: "var(--space-3)" }}
          >
            {/* The route cards are h3, so the list needs its own h2 above them. */}
            <h2 id={listHeadingId} className="pp-title">
              Space-A routes
            </h2>
            <ul
              aria-label="Space-A routes"
              style={{ display: "grid", gap: "var(--space-3)" }}
            >
              {fixtureResults.routes.map((route) => (
                <li key={route.id}>
                  <RouteCard route={route} headingLevel={3} />
                </li>
              ))}
            </ul>
          </section>
        }
        aside={<MapSurface map={fixtureResults.map} size="hero" />}
      />
    </>
  );
}
