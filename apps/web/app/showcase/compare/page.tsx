import { CompareScreen } from "@/components/screens/compare/CompareScreen";
import { fixtureCompare } from "@/lib/presentation/screens/compare";

/** Development-only gallery: the comparison screen rendered from its synthetic fixture. */
export default function ShowcaseComparePage() {
  return <CompareScreen model={fixtureCompare} />;
}
