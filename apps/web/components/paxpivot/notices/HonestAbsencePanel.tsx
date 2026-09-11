import { CommercialBaselineCard } from "@/components/paxpivot/CommercialBaselineCard";
import { SourceLedger } from "@/components/paxpivot/SourceLedger";
import { SourceStateBadge } from "@/components/paxpivot/SourceStateBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  sourceCountText,
  type HonestAbsenceView,
} from "@/lib/presentation/notices";

type Props = { absence: HonestAbsenceView; headingLevel?: 2 | 3 };

/**
 * What the screen shows when nothing usable came back: what was checked, what each source said,
 * the one best next move, an optional commercial way out, and the explanation on demand.
 * It never says there are no flights — a failed or empty check is not that claim.
 */
export function HonestAbsencePanel({ absence, headingLevel = 2 }: Props) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <>
      <Card>
        <Heading className="pp-serif">{absence.title}</Heading>
        <ul className="pp-card__hd" aria-label="What the sources said">
          {absence.summary.map((entry, index) => (
            <li key={`${entry.evidence.state}-${index}`}>
              <span className="pp-fact__l">{sourceCountText(entry.count)}</span>{" "}
              <SourceStateBadge evidence={entry.evidence} />
            </li>
          ))}
        </ul>
        <SourceLedger rows={absence.ledger} />
      </Card>

      <Card tone="muted">
        <CardHeader>
          <span className="pp-card__title">Best move</span>
        </CardHeader>
        <h3 className="pp-row__title">{absence.nextAction.title}</h3>
        <p className="pp-sub">{absence.nextAction.body}</p>
        <Button href={absence.nextAction.action.href}>
          {absence.nextAction.action.label}
        </Button>
      </Card>

      {absence.commercial ? (
        <CommercialBaselineCard
          baseline={absence.commercial}
          headingLevel={3}
        />
      ) : null}

      <p className="pp-inline-actions">
        <Button href={absence.whyHref} variant="ghost" size="sm">
          Why not just say no flights?
        </Button>
      </p>
    </>
  );
}
