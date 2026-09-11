import { FactValue } from "@/components/ui/Facts";
import type { JourneyLegView } from "@/lib/presentation/types";

/** Ordered legs exactly as supplied. Dashed connectors mark a dependency, never a probability. */
export function JourneyTimeline({
  legs,
  label = "Journey",
}: {
  legs: readonly JourneyLegView[];
  label?: string;
}) {
  return (
    <ol className="pp-timeline" aria-label={label}>
      {legs.map((leg) => (
        <li
          key={leg.id}
          className="pp-leg"
          data-kind={leg.kind}
          data-dependency={leg.dependency}
        >
          <span className="pp-leg__mark" aria-hidden="true">
            <span className="pp-leg__dot" />
            <span className="pp-leg__line" />
          </span>
          <div className="pp-leg__body">
            <div className="pp-leg__hd">
              <span className="pp-leg__title">{leg.title}</span>
              <FactValue fact={leg.time} className="pp-leg__time" />
            </div>
            {leg.detail ? (
              <div className="pp-leg__sub">{leg.detail}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
