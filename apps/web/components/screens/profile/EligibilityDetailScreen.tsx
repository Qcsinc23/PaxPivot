import { EvidenceRows } from "@/components/paxpivot/EvidenceRows";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card, Row, Rows } from "@/components/ui/Card";
import { FactStrip } from "@/components/ui/Facts";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { known } from "@/lib/presentation/fact";
import {
  ELIGIBILITY_WORDING,
  type EligibilityDetailScreenModel,
} from "@/lib/presentation/screens/profile";

type Props = { model: EligibilityDetailScreenModel };

/**
 * Where category terminology lives. The decision, its controlling policy, the citations and the
 * traveler rows are all application truth; this screen evaluates nothing, stores nothing, and
 * shows no medical, identity-document or credential field.
 */
export function EligibilityDetailScreen({ model }: Props) {
  const header = <AppHeader title="Eligibility" back={{ href: "/profile" }} />;

  if (model.status === "empty") {
    return (
      <>
        {header}
        <EmptyState
          title="No eligibility decision yet"
          body="Once your party is set, the decision and the policy behind it appear here."
          action={<Button href="/profile">Back to profile</Button>}
        />
      </>
    );
  }

  if (model.status === "loading") {
    return (
      <>
        {header}
        <LoadingState title="Eligibility" body="Loading the decision." />
      </>
    );
  }

  if (model.status === "error") {
    return (
      <>
        {header}
        <ErrorState
          title="We could not load the eligibility decision"
          body="This is a failure on our side, not a decision about your party."
        />
      </>
    );
  }

  const wording = ELIGIBILITY_WORDING[model.decision];

  return (
    <>
      {header}

      <Card>
        <StatusPill tone={wording.tone} srText={wording.srText}>
          {wording.text}
        </StatusPill>
        <FactStrip
          facts={[
            { label: "Controlling policy", value: known(model.policy.id) },
            { label: "Version", value: known(model.policy.version) },
          ]}
        />
      </Card>

      <EvidenceRows rows={model.policy.citations} label="Policy citations" />

      <section style={{ display: "grid", gap: "var(--space-3)" }}>
        <h2 className="pp-title">Why</h2>
        <ul aria-label="Reasons">
          {model.reasons.map((reason, index) => (
            <li key={index} className="pp-sub">
              {reason}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ display: "grid", gap: "var(--space-3)" }}>
        <h2 className="pp-title">Still unresolved</h2>
        {model.unresolved.length > 0 ? (
          <ul aria-label="Unresolved conditions">
            {model.unresolved.map((condition, index) => (
              <li key={index} className="pp-sub">
                {condition}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pp-sub">Nothing is outstanding.</p>
        )}
      </section>

      <section style={{ display: "grid", gap: "var(--space-3)" }}>
        <h2 className="pp-title">Travelers</h2>
        <Rows aria-label="Travelers">
          {model.travelers.map((traveler) => (
            <Row
              key={traveler.id}
              title={traveler.name}
              detail={`${traveler.roleText} · ${traveler.categoryText} · ${traveler.ageBandText} · ${traveler.accompaniedText}`}
            />
          ))}
        </Rows>
      </section>
    </>
  );
}
