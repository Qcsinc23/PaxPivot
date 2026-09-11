import { notFound } from "next/navigation";
import { NotConfigured } from "@/components/shell/NotConfigured";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { FactStrip } from "@/components/ui/Facts";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { readApi } from "@/lib/api/client";
import type { TripRead } from "@/lib/api/contracts";
import { toTripDetailModel } from "@/lib/presentation/adapters/trips";

type Props = { params: Promise<{ tripId: string }> };

/**
 * Live trip route (TASK-034): the request as recorded, and an honest statement that no route
 * has been searched. It never renders synthetic routes or source states.
 */
export const dynamic = "force-dynamic";

export default async function TripPage({ params }: Props) {
  const { tripId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) notFound();
  const result = await readApi<TripRead>(`/api/v1/trips/${tripId}`);
  if (!result.ok) {
    if (result.reason === "not_found") notFound();
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
  const model = toTripDetailModel(result.value);
  return (
    <>
      <AppHeader title={model.title} subtitle={model.createdText} />
      <Card as="div">
        <FactStrip facts={model.facts} />
      </Card>
      <EmptyState
        title="No routes searched yet"
        body="Route search is not built yet. This request is saved; nothing here says what is or is not flying."
      />
    </>
  );
}
