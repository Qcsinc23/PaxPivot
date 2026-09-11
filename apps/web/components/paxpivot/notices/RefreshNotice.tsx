import { SourceStateBadge } from "@/components/paxpivot/SourceStateBadge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import type { RefreshNoticeView } from "@/lib/presentation/notices";

/**
 * A check is running. The count and the bar are the application's numbers; each source shows
 * the state it last established, so "still checking" never reads as "nothing found".
 */
export function RefreshNotice({ notice }: { notice: RefreshNoticeView }) {
  return (
    <Card role="status" aria-live="polite" aria-busy="true">
      <CardHeader>
        <span className="pp-card__title">
          Checking {notice.total} sources · {notice.done} done
        </span>
      </CardHeader>
      <Progress
        label="Sources checked"
        value={notice.done}
        max={Math.max(notice.total, 1)}
      />
      <ul className="pp-card__hd" aria-label="Sources being checked">
        {notice.sources.map((source, index) => (
          <li key={`${source.name}-${index}`}>
            <span className="pp-fact__l">{source.name}</span>{" "}
            <SourceStateBadge evidence={source.evidence} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
