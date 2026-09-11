import { Button } from "@/components/ui/Button";
import { Card, CardActions, CardEnd, CardHeader } from "@/components/ui/Card";
import { FactStrip, FactValue } from "@/components/ui/Facts";
import { StatusPill } from "@/components/ui/Pill";
import type { RouteCardView, RouteHeadline } from "@/lib/presentation/types";
import { SourceStateBadge, SourceStateDisclosure } from "./SourceStateBadge";

export function RouteHeadlinePill({ headline }: { headline: RouteHeadline }) {
  return headline.kind === "best_space_a" ? (
    <StatusPill tone="space-a">Best Space-A</StatusPill>
  ) : (
    <StatusPill tone="ghost">Option {headline.position}</StatusPill>
  );
}

type Props = { route: RouteCardView; headingLevel?: 2 | 3 };

/** A ranked Space-A route: four facts, one line of why, one unknown, two buttons. */
export function RouteCard({ route, headingLevel = 3 }: Props) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const titleId = `${route.id}-title`;
  return (
    <Card as="article" aria-labelledby={titleId}>
      <CardHeader>
        <RouteHeadlinePill headline={route.headline} />
        <SourceStateBadge evidence={route.evidence} />
        {route.attention ? (
          <StatusPill tone={route.attention.tone}>
            {route.attention.label}
          </StatusPill>
        ) : null}
        <CardEnd>
          <span className="sr-only">Known cost </span>
          <FactValue fact={route.knownCost} />
        </CardEnd>
      </CardHeader>
      <Heading id={titleId} className="pp-card__title">
        {route.title}
      </Heading>
      {route.subtitle ? (
        <span className="pp-meta">{route.subtitle}</span>
      ) : null}
      <FactStrip facts={route.facts} />
      <p className="pp-sub">{route.rankingReason}</p>
      {route.unresolved ? (
        <p className="pp-sub">
          <b>Unknown:</b> {route.unresolved}
        </p>
      ) : null}
      <SourceStateDisclosure evidence={route.evidence} />
      <CardActions>
        {route.actions.watchHref ? (
          <Button href={route.actions.watchHref} variant="secondary" size="sm">
            Watch
          </Button>
        ) : null}
        <Button href={route.actions.viewHref} size="sm">
          View route
        </Button>
      </CardActions>
    </Card>
  );
}
