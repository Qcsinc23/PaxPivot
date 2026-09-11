import { TripsScreen } from "@/components/screens/trips/TripsScreen";
import { fixtureTrips } from "@/lib/presentation/screens/trips";

/** Development-only gallery: the Trips shelf rendered from its synthetic fixture. */
export default function ShowcaseTripsPage() {
  return <TripsScreen model={fixtureTrips} />;
}
