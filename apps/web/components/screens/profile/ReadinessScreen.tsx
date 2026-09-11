import { ReadinessList } from "@/components/paxpivot/ReadinessItem";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { UNKNOWN_TEXT } from "@/lib/presentation/fact";
import type { ReadinessView } from "@/lib/presentation/screens/profile";

type Props = {
  status: "empty" | "ready" | "loading" | "error";
  model: ReadinessView;
  backHref: string;
};

/**
 * "Before you go": progress, the checklist with each item's policy text behind its own "Why?",
 * and the one thing the application cannot settle. The acknowledge button is the only accent
 * action on the screen; readiness is never inferred.
 */
export function ReadinessScreen({ status, model, backHref }: Props) {
  const header = <AppHeader title="Before you go" back={{ href: backHref }} />;

  if (status === "empty") {
    return (
      <>
        {header}
        <EmptyState
          title="Nothing to check yet"
          body="Readiness items appear once a trip is being planned."
          action={<Button href={backHref}>Back to profile</Button>}
        />
      </>
    );
  }

  if (status === "loading") {
    return (
      <>
        {header}
        <LoadingState title="Before you go" body="Loading your checklist." />
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        {header}
        <ErrorState
          title="We could not load the checklist"
          body="This is a failure on our side. Nothing has been marked ready or not ready."
        />
      </>
    );
  }

  const { done, total, unresolved } = model;
  const known = done.status === "known" && total.status === "known";

  return (
    <>
      {header}

      {known ? (
        <Progress
          label="Before you go"
          value={done.value}
          max={Math.max(total.value, 1)}
        />
      ) : null}
      <p className="pp-sub">
        {known ? `${done.value} of ${total.value} ready` : UNKNOWN_TEXT}
      </p>

      <ReadinessList items={model.items} />

      {unresolved ? (
        <Card tone="muted">
          <h2 className="pp-title">{unresolved.title}</h2>
          <p className="pp-sub">{unresolved.body}</p>
          <Button variant="accent">{unresolved.acknowledgeLabel}</Button>
        </Card>
      ) : null}

      <StickyActionBar label="Readiness actions">
        <Button>{model.markReadyLabel}</Button>
      </StickyActionBar>
    </>
  );
}
