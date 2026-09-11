import { FactValue } from "@/components/ui/Facts";
import type { EvidenceAgeView } from "@/lib/presentation/types";

/** Source's own time and our read time stay separate; an absent source time reads "Unknown". */
export function EvidenceAge({ age }: { age: EvidenceAgeView }) {
  return (
    <dl className="pp-evidence-age">
      <div className="pp-fact">
        <dt className="pp-fact__l">Page says</dt>
        <dd>
          {age.sourceTime.status === "known" ? (
            <time className="pp-fact__n" dateTime={age.sourceTime.value.iso}>
              {age.sourceTime.value.text}
            </time>
          ) : (
            <FactValue fact={age.sourceTime} />
          )}
        </dd>
      </div>
      <div className="pp-fact">
        <dt className="pp-fact__l">We read it</dt>
        <dd>
          <time className="pp-fact__n" dateTime={age.observedAt.iso}>
            {age.observedAt.text}
          </time>
        </dd>
      </div>
      <div className="pp-fact">
        <dt className="pp-fact__l">Ago</dt>
        <dd>
          <FactValue fact={age.ageText} />
        </dd>
      </div>
    </dl>
  );
}
