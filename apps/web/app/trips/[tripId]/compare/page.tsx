import { CompareScreen } from "@/components/screens/compare/CompareScreen";
import { emptyCompare } from "@/lib/presentation/screens/compare";

/**
 * Live comparison route. No comparison API contract exists yet, so this renders the honest
 * empty state and never a synthetic side-by-side.
 */
export default function ComparePage() {
  return <CompareScreen model={emptyCompare} />;
}
