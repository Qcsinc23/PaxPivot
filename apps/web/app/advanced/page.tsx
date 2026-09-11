import { SourceHealthScreen } from "@/components/screens/advanced/SourceHealthScreen";
import { emptySourceHealth } from "@/lib/presentation/screens/advanced";

/**
 * Live Advanced route. No operations API contract exists yet, so this renders the honest empty
 * state and never a synthetic source registry.
 */
export default function AdvancedPage() {
  return <SourceHealthScreen model={emptySourceHealth} />;
}
