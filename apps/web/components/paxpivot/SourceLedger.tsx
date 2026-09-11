import { Row, Rows } from "@/components/ui/Card";
import type { SourceLedgerRowView } from "@/lib/presentation/types";
import { SourceStateBadge } from "./SourceStateBadge";

/** Which sources were checked and what each one said — the strip behind every honest absence. */
export function SourceLedger({
  rows,
  label = "Sources checked",
}: {
  rows: readonly SourceLedgerRowView[];
  label?: string;
}) {
  return (
    <Rows aria-label={label}>
      {rows.map((row) => (
        <Row
          key={row.id}
          title={row.name}
          detail={row.detail}
          href={row.href}
          end={<SourceStateBadge evidence={row.evidence} />}
        />
      ))}
    </Rows>
  );
}
