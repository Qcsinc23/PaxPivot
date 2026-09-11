import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardActions, CardEnd, CardHeader } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Pill";
import type { TripCardView } from "@/lib/presentation/types";
import { RouteHeadlinePill } from "./RouteCard";
import { SourceStateBadge, lexemeFor } from "./SourceStateBadge";

type Props = { trip: TripCardView; headingLevel?: 2 | 3 };

export function TripCard({ trip, headingLevel = 3 }: Props) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const titleId = useId();
  return (
    <Card as="article" aria-labelledby={titleId}>
      <CardHeader>
        <Heading id={titleId} className="pp-card__title">
          {trip.name}
        </Heading>
        {trip.change ? (
          <CardEnd>
            <StatusPill tone={trip.change.tone}>{trip.change.label}</StatusPill>
          </CardEnd>
        ) : null}
      </CardHeader>
      <span className="pp-meta">
        {trip.windowText} · {trip.partyText}
      </span>
      {trip.top ? (
        <div className="pp-card__hd">
          {trip.top.headline === "safest_overall" ? (
            <StatusPill tone="best">Safest overall</StatusPill>
          ) : (
            <RouteHeadlinePill headline={trip.top.headline} />
          )}
          <span className="pp-row__title">{trip.top.title}</span>
          <SourceStateBadge evidence={trip.top.evidence} />
        </div>
      ) : null}
      <div className="pp-card__hd">
        {trip.sources.map((source, index) => {
          const lexeme = lexemeFor(source.evidence.state);
          return (
            <StatusPill
              key={`${source.evidence.state}-${index}`}
              tone={lexeme.tone}
              srText={lexeme.srText}
            >
              {source.count} {lexeme.label.toLowerCase()}
            </StatusPill>
          );
        })}
      </div>
      <CardActions>
        <Button href={trip.href} size="sm" block>
          Open
        </Button>
      </CardActions>
    </Card>
  );
}
