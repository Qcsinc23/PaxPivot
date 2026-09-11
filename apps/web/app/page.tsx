import { AppHeader } from "@/components/ui/AppHeader";
import { EmptyState } from "@/components/ui/States";

export default function PlanPage() {
  return (
    <>
      <AppHeader title="Plan" />
      <EmptyState
        title="Where to?"
        body="Journey planning is not available yet. Trip requests arrive with the Plan task."
      />
    </>
  );
}
