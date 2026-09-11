import { ResultsScreen } from "@/components/screens/results/ResultsScreen";
import { fixtureResults } from "@/lib/presentation/screens/results";

/** Development-only gallery: the Results screen rendered from its synthetic fixture. */
export default function ShowcaseResultsPage() {
  return <ResultsScreen model={fixtureResults} />;
}
