import {
  SourceStateBadge,
  SourceStateDisclosure,
} from "@/components/paxpivot/SourceStateBadge";
import { Card, CardEnd, CardHeader, Row, Rows } from "@/components/ui/Card";
import type { ConflictNoticeView } from "@/lib/presentation/notices";

/**
 * Two official sources disagree. Both claims are shown with their own dates; nothing is
 * picked as the winner in the browser. The conflict is held for a person to settle.
 */
export function ConflictNotice({ notice }: { notice: ConflictNoticeView }) {
  return (
    <Card tone="muted">
      <CardHeader>
        <span className="pp-card__title">{notice.sourceName}</span>
        <CardEnd>
          <SourceStateBadge evidence={notice.evidence} />
        </CardEnd>
      </CardHeader>
      <Rows aria-label="Official claims">
        {notice.claims.map((claim, index) => (
          <Row
            key={`${claim.source}-${index}`}
            title={claim.claim}
            detail={`${claim.source} · ${claim.dateText}`}
          />
        ))}
      </Rows>
      <p className="pp-sub">
        Held until a person decides; neither claim is treated as current.
      </p>
      <SourceStateDisclosure evidence={notice.evidence} />
    </Card>
  );
}
