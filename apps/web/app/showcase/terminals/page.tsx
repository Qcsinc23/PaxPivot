import { TerminalNetworkScreen } from "@/components/screens/terminals/TerminalNetworkScreen";
import { fixtureTerminalNetwork } from "@/lib/presentation/screens/terminals";

/** Development-only gallery: the terminal network rendered from its synthetic fixture. */
export default function ShowcaseTerminalsPage() {
  return <TerminalNetworkScreen model={fixtureTerminalNetwork} />;
}
