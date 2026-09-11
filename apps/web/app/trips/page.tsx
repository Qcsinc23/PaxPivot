import { TripsScreen } from "@/components/screens/trips/TripsScreen";
import { NotConfigured } from "@/components/shell/NotConfigured";
import { readApi } from "@/lib/api/client";
import type { TripListRead } from "@/lib/api/contracts";
import { toTripsScreenModel } from "@/lib/presentation/adapters/trips";
import { emptyTrips } from "@/lib/presentation/screens/trips";

/**
 * Live Trips route (TASK-034). Reads `GET /api/v1/trips` on the server. An empty list is the
 * honest empty state; a configuration or API failure is an error, never "no trips".
 */
export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const result = await readApi<TripListRead>("/api/v1/trips");
  if (!result.ok) {
    if (result.reason === "not_configured")
      return <NotConfigured title="Trips" />;
    return <TripsScreen model={{ ...emptyTrips, status: "error" }} />;
  }
  if (result.value.trips.length === 0)
    return <TripsScreen model={emptyTrips} />;
  return <TripsScreen model={toTripsScreenModel(result.value)} />;
}
