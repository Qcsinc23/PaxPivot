import { RouteDetailScreen } from "@/components/screens/route-detail/RouteDetailScreen";
import { fixtureRouteDetail } from "@/lib/presentation/screens/route-detail";

/** Development-only gallery: the route detail screen rendered from its synthetic fixture. */
export default function ShowcaseRouteDetailPage() {
  return <RouteDetailScreen model={fixtureRouteDetail} />;
}
