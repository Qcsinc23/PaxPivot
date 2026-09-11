import { TerminalDetailScreen } from "@/components/screens/terminals/TerminalDetailScreen";
import { emptyTerminalDetail } from "@/lib/presentation/screens/terminals";

/**
 * Live terminal detail route. No terminal API contract exists yet, so this renders the honest
 * empty state and never synthetic entrance, hours, opportunity or history data.
 */
export default function TerminalDetailPage() {
  return <TerminalDetailScreen model={emptyTerminalDetail} />;
}
