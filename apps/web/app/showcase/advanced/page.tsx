import { SourceHealthScreen } from "@/components/screens/advanced/SourceHealthScreen";
import { fixtureSourceHealth } from "@/lib/presentation/screens/advanced";

/** Development-only gallery: source health rendered from its synthetic fixture. */
export default function ShowcaseAdvancedPage() {
  return <SourceHealthScreen model={fixtureSourceHealth} />;
}
