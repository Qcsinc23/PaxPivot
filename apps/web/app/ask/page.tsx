import { AskScreen } from "@/components/screens/ask/AskScreen";
import { emptyAsk } from "@/lib/presentation/screens/ask";

/**
 * Live Ask route. No Ask tool contract exists yet, so this renders the honest empty state: the
 * composer is present but disabled, and no synthetic answer is ever shown.
 */
export default function AskPage() {
  return <AskScreen model={emptyAsk} />;
}
