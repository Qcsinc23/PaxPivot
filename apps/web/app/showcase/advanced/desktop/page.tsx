import { ResultsScreen } from "@/components/screens/results/ResultsScreen";
import { fixtureResults } from "@/lib/presentation/screens/results";

/**
 * Development-only desktop composition of Results. The screen owns its own split: the map is
 * first in the document (phone order) and sits beside the list from 60rem up, so this page just
 * renders the ready fixture. Resize the window to see both compositions from one tree.
 */
export default function ShowcaseDesktopCompositionPage() {
  return <ResultsScreen model={fixtureResults} />;
}
