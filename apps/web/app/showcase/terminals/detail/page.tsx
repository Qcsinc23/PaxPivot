import { TerminalDetailScreen } from "@/components/screens/terminals/TerminalDetailScreen";
import { fixtureTerminalDetail } from "@/lib/presentation/screens/terminals";

/** Development-only gallery: terminal detail rendered from its synthetic fixture. */
export default function ShowcaseTerminalDetailPage() {
  return <TerminalDetailScreen model={fixtureTerminalDetail} />;
}
