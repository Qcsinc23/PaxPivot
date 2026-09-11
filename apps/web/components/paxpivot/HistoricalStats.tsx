import Link from "next/link";
import { StatGrid } from "@/components/ui/Facts";
import { known, unknown } from "@/lib/presentation/fact";
import type { HistoricalSummaryView } from "@/lib/presentation/types";

/** Descriptive counts with their denominators (PRD §10.2). No rate, likelihood or forecast. */
export function historySentence(history: HistoricalSummaryView): string {
  if (
    history.observed.status === "known" &&
    history.successfulChecks.status === "known"
  ) {
    const n = history.observed.value;
    return `Observed ${n} ${n === 1 ? "time" : "times"} in ${history.successfulChecks.value} successful checks, ${history.periodText}.`;
  }
  return `Observation count unknown for the ${history.periodText}.`;
}

export function HistoricalStats({
  history,
}: {
  history: HistoricalSummaryView;
}) {
  const median =
    history.medianSeats.status === "known"
      ? known(
          `${history.medianSeats.value.value} (n=${history.medianSeats.value.sampleSize})`,
        )
      : unknown(history.medianSeats.note);
  return (
    <section className="pp-card" aria-label="Observation history">
      <p className="pp-sub">{historySentence(history)}</p>
      <StatGrid
        stats={[
          {
            label: "Observed",
            value:
              history.observed.status === "known"
                ? known(String(history.observed.value))
                : unknown(history.observed.note),
          },
          {
            label: "Successful checks",
            value:
              history.successfulChecks.status === "known"
                ? known(String(history.successfulChecks.value))
                : unknown(history.successfulChecks.note),
          },
          { label: "Since last", value: history.sinceLastText },
          { label: "Median published seats", value: median },
        ]}
      />
      <p className="pp-meta">{history.coverageNote}</p>
      {history.methodologyHref ? (
        <Link href={history.methodologyHref}>About these numbers</Link>
      ) : null}
    </section>
  );
}
