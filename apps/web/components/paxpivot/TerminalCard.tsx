import { Button } from "@/components/ui/Button";
import { Card, CardActions, CardHeader } from "@/components/ui/Card";
import { FactStrip } from "@/components/ui/Facts";
import { StatusPill } from "@/components/ui/Pill";
import type { TerminalCardView } from "@/lib/presentation/types";
import { SourceStateBadge, SourceStateDisclosure } from "./SourceStateBadge";

type Props = { terminal: TerminalCardView; headingLevel?: 2 | 3 };

export function TerminalCard({ terminal, headingLevel = 3 }: Props) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const titleId = `${terminal.id}-title`;
  return (
    <Card as="article" aria-labelledby={titleId}>
      <CardHeader>
        <Heading id={titleId} className="pp-card__title">
          {terminal.name}
        </Heading>
        <span className="pp-card__end">
          <SourceStateBadge evidence={terminal.evidence} />
        </span>
      </CardHeader>
      {terminal.installation ? (
        <span className="pp-meta">{terminal.installation}</span>
      ) : null}
      <FactStrip
        facts={[
          { label: "From you", value: terminal.accessText },
          { label: "Entrance", value: terminal.entrance.label },
        ]}
      />
      {terminal.entrance.status === "verified" ? (
        <StatusPill tone="verified">Entrance verified</StatusPill>
      ) : (
        <StatusPill
          tone="unknown"
          srText="no verified passenger entrance on record"
        >
          Entrance unverified
        </StatusPill>
      )}
      <SourceStateDisclosure evidence={terminal.evidence} />
      <CardActions>
        <Button href={terminal.href} variant="secondary" size="sm">
          View terminal
        </Button>
      </CardActions>
    </Card>
  );
}
