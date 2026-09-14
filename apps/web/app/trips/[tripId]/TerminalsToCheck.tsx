import { useId } from "react";
import { EvidenceAge } from "@/components/paxpivot/EvidenceAge";
import { SourceStateBadge } from "@/components/paxpivot/SourceStateBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardActions, CardHeader } from "@/components/ui/Card";
import { FactStrip } from "@/components/ui/Facts";
import { ScreenSection } from "@/components/ui/ScreenSection";
import type {
  TerminalsToCheckViewModel,
  TerminalToCheckRowView,
} from "@/lib/presentation/adapters/terminals-to-check";

/** One registered terminal: its state, read age, and the two links honest here. */
function TerminalToCheckCard({ row }: { row: TerminalToCheckRowView }) {
  const titleId = useId();
  return (
    <Card as="article" aria-labelledby={titleId}>
      <CardHeader>
        <h3 id={titleId} className="pp-card__title">
          {row.name}
        </h3>
        <span className="pp-card__end">
          <SourceStateBadge evidence={row.evidence} />
        </span>
      </CardHeader>
      {row.isOrigin ? <span className="pp-meta">Your origin</span> : null}
      {row.installation ? (
        <span className="pp-meta">{row.installation}</span>
      ) : null}
      {row.age ? (
        <EvidenceAge age={row.age} />
      ) : (
        <p className="pp-sub">
          PaxPivot has not read a source for this terminal yet.
        </p>
      )}
      <FactStrip facts={row.facts} />
      {row.schedule.status === "known" ? (
        <p className="pp-sub">
          <a href={row.schedule.value.href}>{row.schedule.value.label}</a>
        </p>
      ) : (
        <p className="pp-sub">{row.schedule.note}</p>
      )}
      <CardActions>
        {row.officialHref ? (
          <Button href={row.officialHref} variant="ghost" size="sm">
            Official page
          </Button>
        ) : null}
      </CardActions>
    </Card>
  );
}

/**
 * TASK-044: an honest answer to "where should I go to fly?" — every registered pilot terminal,
 * origin first, each with its own effective source state, read age, official link and (where
 * PaxPivot could load it) the registered restricted 72-hour schedule link. Never a ranking,
 * never a claim about flights, departures or seats.
 */
export function TerminalsToCheck({
  model,
}: {
  model: TerminalsToCheckViewModel;
}) {
  return (
    <ScreenSection title="Terminals to check">
      <p className="pp-sub">{model.notARankingNote}</p>
      <p className="pp-sub">{model.noScheduleAccessNote}</p>
      <ul
        aria-label="Terminals to check"
        style={{ display: "grid", gap: "var(--space-3)" }}
      >
        {model.rows.map((row) => (
          <li key={row.id}>
            <TerminalToCheckCard row={row} />
          </li>
        ))}
      </ul>
    </ScreenSection>
  );
}
