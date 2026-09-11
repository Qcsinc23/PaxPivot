import { NewTripForm } from "@/components/screens/plan/NewTripForm";
import { NotConfigured } from "@/components/shell/NotConfigured";
import { AppHeader } from "@/components/ui/AppHeader";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { readApi } from "@/lib/api/client";
import type { TerminalNetworkRead } from "@/lib/api/contracts";

type Props = { searchParams: Promise<{ error?: string | string[] }> };

/**
 * Live Plan route (TASK-034). A trip request is what the traveler asks for: origin terminal,
 * destination in their own words, a window and a party. No route is searched yet, and the page
 * says so; nothing here presents a synthetic result.
 */
export const dynamic = "force-dynamic";

export default async function PlanPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const result = await readApi<TerminalNetworkRead>("/api/v1/terminals");
  if (!result.ok) {
    if (result.reason === "not_configured")
      return <NotConfigured title="Plan" />;
    return (
      <>
        <AppHeader title="Plan" />
        <ErrorState
          title="We could not load the terminals"
          body="This is a failure on our side, not a statement about what is flying."
        />
      </>
    );
  }
  const terminals = result.value.terminals.map((t) => ({
    id: t.terminal_id,
    name: t.name,
  }));
  if (terminals.length === 0) {
    return (
      <>
        <AppHeader title="Plan" />
        <EmptyState
          title="No terminals yet"
          body="A trip request needs an origin terminal, and none is registered."
        />
      </>
    );
  }
  return (
    <>
      <AppHeader
        title="Plan"
        subtitle="Tell us where you want to go. Route search is not built yet; your request is kept."
      />
      <NewTripForm
        terminals={terminals}
        error={Array.isArray(error) ? error[0] : error}
      />
    </>
  );
}
