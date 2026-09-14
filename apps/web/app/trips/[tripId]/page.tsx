import { notFound } from "next/navigation";
import { GUARANTEE_TEXT } from "@/components/shell/AppShell";
import { NotConfigured } from "@/components/shell/NotConfigured";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { FactStrip } from "@/components/ui/Facts";
import { ErrorState } from "@/components/ui/States";
import { readApi } from "@/lib/api/client";
import type { ApiResult } from "@/lib/api/client";
import type {
  TerminalDetailRead,
  TerminalNetworkRead,
  TripRead,
} from "@/lib/api/contracts";
import { toCommercialHandoffViewModel } from "@/lib/presentation/adapters/commercial-handoff";
import { toTerminalsToCheckViewModel } from "@/lib/presentation/adapters/terminals-to-check";
import { toTripDetailModel } from "@/lib/presentation/adapters/trips";
import { CommercialHandoff } from "./CommercialHandoff";
import { TerminalsToCheck } from "./TerminalsToCheck";

type Props = { params: Promise<{ tripId: string }> };

/**
 * Live trip route (TASK-034, TASK-044): the request as recorded, and an honest, non-ranked list
 * of every registered pilot terminal worth checking for this trip. It never renders a route, an
 * opportunity, or any claim about flights, departures, seats or probability.
 */
export const dynamic = "force-dynamic";

/**
 * One `/api/v1/terminals/{id}` read per registered terminal, run in parallel (ponytail note in
 * `lib/presentation/adapters/terminals-to-check.ts`). A failed read never removes a terminal from
 * the list — it only means that terminal's schedule link cannot be shown right now.
 */
async function readTerminalDetails(
  network: TerminalNetworkRead,
): Promise<Map<string, ApiResult<TerminalDetailRead>>> {
  const entries = await Promise.all(
    network.terminals.map(async (terminal) => {
      const detail = await readApi<TerminalDetailRead>(
        `/api/v1/terminals/${terminal.terminal_id}`,
      );
      return [terminal.terminal_id, detail] as const;
    }),
  );
  return new Map(entries);
}

export default async function TripPage({ params }: Props) {
  const { tripId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tripId,
    )
  )
    notFound();
  const result = await readApi<TripRead>(`/api/v1/trips/${tripId}`);
  if (!result.ok) {
    if (result.reason === "not_found" || result.reason === "invalid")
      notFound();
    if (result.reason === "not_configured")
      return <NotConfigured title="Trip" />;
    return (
      <>
        <AppHeader title="Trip" />
        <ErrorState
          title="We could not load this trip"
          body="This is a failure on our side. Your request is unchanged."
        />
      </>
    );
  }
  const trip = result.value;
  const model = toTripDetailModel(trip);
  const networkResult = await readApi<TerminalNetworkRead>("/api/v1/terminals");

  return (
    <>
      <AppHeader title={model.title} subtitle={model.createdText} />
      <Card as="div">
        <FactStrip facts={model.facts} />
      </Card>
      {networkResult.ok ? (
        <TerminalsToCheck
          model={toTerminalsToCheckViewModel(
            trip,
            networkResult.value,
            await readTerminalDetails(networkResult.value),
            { now: new Date() },
          )}
        />
      ) : (
        <ErrorState
          title="We could not load the terminals to check"
          body="This is a failure on our side. Your request is unchanged."
        />
      )}
      <CommercialHandoff model={toCommercialHandoffViewModel(trip)} />
      <p className="pp-sub">{GUARANTEE_TEXT}</p>
    </>
  );
}
