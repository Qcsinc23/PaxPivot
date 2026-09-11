import { Activity } from "lucide-react";
import { EvidenceRows } from "@/components/paxpivot/EvidenceRows";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, CardHeader, Row, Rows } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Pill";
import { Progress } from "@/components/ui/Progress";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { UNKNOWN_TEXT } from "@/lib/presentation/fact";
import {
  eligibilitySummaryText,
  ELIGIBILITY_WORDING,
  type ProfileScreenModel,
} from "@/lib/presentation/screens/profile";

type Props = { model: ProfileScreenModel };

/** "2 of 4 ready", or "Unknown" when the application has not established the numbers. */
export function readinessText(model: ProfileScreenModel): string {
  const { done, total } = model.readiness;
  return done.status === "known" && total.status === "known"
    ? `${done.value} of ${total.value} ready`
    : UNKNOWN_TEXT;
}

/**
 * Profile: the party in traveler wording, the readiness summary, notification preferences and
 * the way to the eligibility detail. Category codes deliberately do not appear on this surface.
 */
export function ProfileScreen({ model }: Props) {
  const header = (
    <AppHeader
      title="Profile"
      actions={
        <IconButton
          href={model.advancedHref}
          label="Advanced"
          icon={<Activity className="pp-i-lg" aria-hidden="true" />}
        />
      }
    />
  );

  if (model.status === "empty") {
    return (
      <>
        {header}
        <EmptyState
          title="No profile yet"
          body="Add your party and we will show what applies to you."
          action={<Button href={model.advancedHref}>Get started</Button>}
        />
      </>
    );
  }

  if (model.status === "loading") {
    return (
      <>
        {header}
        <LoadingState
          title="Profile"
          body="Loading your party and readiness."
        />
      </>
    );
  }

  if (model.status === "error") {
    return (
      <>
        {header}
        <ErrorState
          title="We could not load your profile"
          body="This is a failure on our side. Nothing about your party has changed."
        />
      </>
    );
  }

  const wording = ELIGIBILITY_WORDING[model.eligibility.state];
  const { done, total } = model.readiness;
  const readinessKnown = done.status === "known" && total.status === "known";

  return (
    <>
      {header}

      <Card>
        <CardHeader>
          <StatusPill tone={wording.tone} srText={wording.srText}>
            {eligibilitySummaryText(model.eligibility)}
          </StatusPill>
        </CardHeader>
        <h2 className="pp-serif">Your party</h2>
        <Rows aria-label="Travel party">
          {model.party.map((member) => (
            <Row
              key={member.id}
              title={member.name}
              detail={member.roleText}
              href={member.href}
            />
          ))}
        </Rows>
        {model.eligibility.detailHref ? (
          <Button href={model.eligibility.detailHref} variant="ghost" size="sm">
            Why this eligibility decision?
          </Button>
        ) : null}
      </Card>

      <Card as="div">
        <h2 className="pp-title">Before you go</h2>
        {readinessKnown ? (
          <Progress
            label="Before you go"
            value={done.value}
            max={Math.max(total.value, 1)}
          />
        ) : null}
        <p className="pp-sub">{readinessText(model)}</p>
        {model.readiness.dueText ? (
          <p className="pp-meta">{model.readiness.dueText}</p>
        ) : null}
        <Button href="/profile/readiness" variant="secondary" size="sm">
          Open the checklist
        </Button>
      </Card>

      <Card tone="muted">
        <h2 className="pp-title">Notifications</h2>
        <EvidenceRows
          rows={model.notifications.rows}
          label="Notification preferences"
        />
        <Button href={model.notifications.href} variant="ghost" size="sm">
          Notification settings
        </Button>
      </Card>
    </>
  );
}
