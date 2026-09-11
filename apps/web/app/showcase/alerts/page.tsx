import { AlertsScreen } from "@/components/screens/alerts/AlertsScreen";
import { fixtureAlerts } from "@/lib/presentation/screens/alerts";

/** Development-only gallery: the Alerts feed rendered from its synthetic fixture. */
export default function ShowcaseAlertsPage() {
  return <AlertsScreen model={fixtureAlerts} />;
}
