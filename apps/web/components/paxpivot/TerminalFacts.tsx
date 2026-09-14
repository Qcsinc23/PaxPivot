import { Row, Rows } from "@/components/ui/Card";
import { FactValue } from "@/components/ui/Facts";
import type { TerminalFactRowView } from "@/lib/presentation/types";

/**
 * A terminal operating fact (hours, phone, email, ...) beside its own "Page says / Read at"
 * provenance (TASK-048) — the same pairing `EvidenceAge` already renders for a source's overall
 * currency, extended to every individual fact. No wording implies a value is guaranteed or still
 * current beyond the read time shown.
 */
export function TerminalFacts({
  facts,
}: {
  facts: readonly TerminalFactRowView[];
}) {
  if (facts.length === 0) return null;
  return (
    <Rows aria-label="Terminal facts">
      {facts.map((fact) => (
        <Row
          key={fact.id}
          title={fact.label}
          detail={
            <>
              Page says <FactValue fact={fact.value} className="" /> · Read at{" "}
              <time dateTime={fact.readAt.iso}>{fact.readAt.text}</time>
            </>
          }
        />
      ))}
    </Rows>
  );
}
