import { ResultsScreen } from "@/components/screens/results/ResultsScreen";
import { fixtureResultsRefreshing } from "@/lib/presentation/screens/results";

/** Development-only gallery: Results while a re-check runs and the last result is kept. */
export default function ShowcaseResultsRefreshingPage() {
  return <ResultsScreen model={fixtureResultsRefreshing} />;
}
