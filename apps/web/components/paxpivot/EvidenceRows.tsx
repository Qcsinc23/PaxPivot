import { ChevronRight } from "lucide-react";
import { Row, Rows } from "@/components/ui/Card";
import { FactValue } from "@/components/ui/Facts";
import { StatusPill } from "@/components/ui/Pill";
import { factText } from "@/lib/presentation/fact";
import type { EvidenceRowView } from "@/lib/presentation/types";

/** Provenance and evidence as rows, not paragraphs. */
export function EvidenceRows({
  rows,
  label = "Evidence",
}: {
  rows: readonly EvidenceRowView[];
  label?: string;
}) {
  return (
    <Rows aria-label={label}>
      {rows.map((row) => (
        <Row
          key={row.id}
          title={row.label}
          detail={
            row.tone ? undefined : (
              <FactValue fact={row.value} className="pp-row__sub" />
            )
          }
          href={row.href}
          end={
            <>
              {row.tone ? (
                <StatusPill tone={row.tone}>{factText(row.value)}</StatusPill>
              ) : null}
              {row.href ? (
                <ChevronRight className="pp-i" aria-hidden="true" />
              ) : null}
            </>
          }
        />
      ))}
    </Rows>
  );
}
