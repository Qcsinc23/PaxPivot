import {
  SourceStateBadge,
  SourceStateDisclosure,
} from "@/components/paxpivot/SourceStateBadge";
import { Card, CardEnd, CardHeader } from "@/components/ui/Card";
import { FactStrip } from "@/components/ui/Facts";
import { known } from "@/lib/presentation/fact";
import type { LateCheckNoticeView } from "@/lib/presentation/notices";

/**
 * A scheduled check ran late. The last result stays exactly as it was — this notice says so
 * rather than letting a late run imply fresh news. "Why?" opens the application's explanation.
 */
export function LateCheckNotice({ notice }: { notice: LateCheckNoticeView }) {
  return (
    <Card tone="muted">
      <CardHeader>
        <span className="pp-card__title">{notice.sourceName}</span>
        <CardEnd>
          <SourceStateBadge evidence={notice.evidence} />
        </CardEnd>
      </CardHeader>
      <FactStrip
        facts={[
          { label: "Expected", value: known(notice.dueText) },
          { label: "Late by", value: known(notice.lateByText) },
        ]}
      />
      <p className="pp-sub">
        The last result stays on screen and is still stale until this check
        finishes.
      </p>
      <SourceStateDisclosure evidence={notice.evidence} />
    </Card>
  );
}
