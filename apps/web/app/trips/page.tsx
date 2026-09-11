import { TripsScreen } from "@/components/screens/trips/TripsScreen";
import { emptyTrips } from "@/lib/presentation/screens/trips";

/**
 * Live Trips route. No trips API contract exists yet, so this renders the honest empty state and
 * never synthetic trips or source summaries.
 */
export default function TripsPage() {
  return <TripsScreen model={emptyTrips} />;
}
