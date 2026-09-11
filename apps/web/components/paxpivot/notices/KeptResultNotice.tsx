import { SourceStateBadge } from "@/components/paxpivot/SourceStateBadge";
import { Card, CardEnd, CardHeader } from "@/components/ui/Card";
import { FactStrip } from "@/components/ui/Facts";
import type { KeptResultNoticeView } from "@/lib/presentation/notices";

/**
 * The previous result stays on screen, dimmed and labelled with the time it was read, while a
 * new check runs. The badge reports the model's own state; the screen never marks it stale
 * itself, and never silently swaps in an empty list.
 */
export function KeptResultNotice({ notice }: { notice: KeptResultNoticeView }) {
  return (
    <Card tone="muted">
      <CardHeader>
        <span className="pp-card__title">{notice.title}</span>
        <CardEnd>
          <SourceStateBadge evidence={notice.evidence} />
        </CardEnd>
      </CardHeader>
      <span className="pp-meta">
        Read {notice.fromText} · kept on screen while we re-check
      </span>
      <FactStrip facts={notice.facts} />
    </Card>
  );
}
