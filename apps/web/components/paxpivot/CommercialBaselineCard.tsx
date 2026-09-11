import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardActions, CardEnd, CardHeader } from "@/components/ui/Card";
import { FactStrip, FactValue } from "@/components/ui/Facts";
import { StatusPill } from "@/components/ui/Pill";
import type { CommercialBaselineView } from "@/lib/presentation/types";
import { HandoffLabel } from "./Handoff";
import { SourceStateBadge } from "./SourceStateBadge";

type Props = { baseline: CommercialBaselineView; headingLevel?: 2 | 3 };

/**
 * The commercial baseline is a different product from a Space-A route and looks like one:
 * flat surface, "Safest overall" or "Fallback", a provider quote and the mandatory handoff label.
 */
export function CommercialBaselineCard({ baseline, headingLevel = 3 }: Props) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const titleId = useId();
  return (
    <Card as="article" tone="handoff" aria-labelledby={titleId}>
      <CardHeader>
        {baseline.headline === "safest_overall" ? (
          <StatusPill tone="best">Safest overall</StatusPill>
        ) : (
          <StatusPill tone="ghost">Fallback</StatusPill>
        )}
        {baseline.quoteEvidence ? (
          <SourceStateBadge evidence={baseline.quoteEvidence} />
        ) : null}
        <CardEnd>
          <span className="sr-only">Provider quote </span>
          <FactValue fact={baseline.quote} />
        </CardEnd>
      </CardHeader>
      <Heading id={titleId} className="pp-card__title">
        {baseline.title}
      </Heading>
      {baseline.subtitle ? (
        <span className="pp-meta">{baseline.subtitle}</span>
      ) : null}
      <FactStrip facts={baseline.facts} />
      <p className="pp-sub">{baseline.rankingReason}</p>
      <HandoffLabel kind={baseline.unknown} />
      <CardActions>
        {baseline.actions.watchHref ? (
          <Button
            href={baseline.actions.watchHref}
            variant="secondary"
            size="sm"
          >
            Watch
          </Button>
        ) : null}
        <Button href={baseline.actions.openHref} size="sm">
          Open provider search
        </Button>
      </CardActions>
    </Card>
  );
}
