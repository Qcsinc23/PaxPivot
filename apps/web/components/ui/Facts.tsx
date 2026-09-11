import { factText, type Fact } from "@/lib/presentation/fact";
import type { FactView } from "@/lib/presentation/types";

type ValueProps<T> = {
  fact: Fact<T>;
  format?: (value: T) => string;
  className?: string;
};

/** Renders a fact's value; unknown facts read "Unknown" and carry the application's note. */
export function FactValue<T>({
  fact,
  format,
  className = "pp-fact__n",
}: ValueProps<T>) {
  const knownValue = fact.status === "known";
  return (
    <span className={className} data-known={knownValue ? "true" : "false"}>
      {factText(fact, format)}
      {!knownValue && fact.note ? (
        <span className="sr-only">: {fact.note}</span>
      ) : null}
    </span>
  );
}

/** Inline key numbers inside a card. */
export function FactStrip({ facts }: { facts: readonly FactView[] }) {
  return (
    <dl className="pp-facts">
      {facts.map((fact) => (
        <div key={fact.label} className="pp-fact">
          <dt className="pp-fact__l">{fact.label}</dt>
          <dd>
            <FactValue fact={fact.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Stat tiles: the number is the content. */
export function StatGrid({ stats }: { stats: readonly FactView[] }) {
  return (
    <dl className="pp-stats">
      {stats.map((stat) => (
        <div key={stat.label} className="pp-stat pp-fact">
          <dt className="pp-fact__l">{stat.label}</dt>
          <dd>
            <FactValue fact={stat.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
