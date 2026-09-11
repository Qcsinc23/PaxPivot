import { ResultsScreen } from "@/components/screens/results/ResultsScreen";
import { fixtureResultsNoRoute } from "@/lib/presentation/screens/results";

/** Development-only gallery: Results when nothing usable came back. */
export default function ShowcaseResultsNoRoutePage() {
  return <ResultsScreen model={fixtureResultsNoRoute} />;
}
