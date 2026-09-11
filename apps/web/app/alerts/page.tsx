import { AlertsScreen } from "@/components/screens/alerts/AlertsScreen";
import { emptyAlerts } from "@/lib/presentation/screens/alerts";

/**
 * Live Alerts route. No notifications API contract exists yet, so this renders the honest empty
 * state and never synthetic alerts.
 */
export default function AlertsPage() {
  return <AlertsScreen model={emptyAlerts} />;
}
