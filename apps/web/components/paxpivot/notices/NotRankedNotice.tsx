import { SourceLedger } from "@/components/paxpivot/SourceLedger";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  sourceCountText,
  type NotRankedNoticeView,
} from "@/lib/presentation/notices";

/**
 * Sources that came back but were not ranked. Each keeps the state it reported, and the notice
 * says plainly that none of those states is evidence about what is flying.
 */
export function NotRankedNotice({ notice }: { notice: NotRankedNoticeView }) {
  return (
    <Card tone="flat">
      <CardHeader>
        <span className="pp-card__title">
          {sourceCountText(notice.count)} not ranked
        </span>
      </CardHeader>
      <SourceLedger rows={notice.rows} label="Sources not ranked" />
      <p className="pp-sub">
        None of these states is evidence that nothing is flying.
      </p>
      <Button href={notice.href} variant="ghost" size="sm">
        See what was checked
      </Button>
    </Card>
  );
}
