import { TerminalNetworkScreen } from "@/components/screens/terminals/TerminalNetworkScreen";
import { emptyTerminalNetwork } from "@/lib/presentation/screens/terminals";

/**
 * Live Terminals route. No terminal API contract exists yet, so this renders the honest empty
 * state and never a synthetic network, travel time or entrance claim.
 */
export default function TerminalsPage() {
  return <TerminalNetworkScreen model={emptyTerminalNetwork} />;
}
