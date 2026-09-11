import { RouteDetailScreen } from "@/components/screens/route-detail/RouteDetailScreen";
import { emptyRouteDetail } from "@/lib/presentation/screens/route-detail";

/**
 * Live route detail. No route API contract exists yet, so this renders the honest empty state
 * and never a synthetic journey, source record or history.
 */
export default function RouteDetailPage() {
  return <RouteDetailScreen model={emptyRouteDetail} />;
}
