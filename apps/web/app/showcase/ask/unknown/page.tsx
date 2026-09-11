import { AskScreen } from "@/components/screens/ask/AskScreen";
import { fixtureAskUnknown } from "@/lib/presentation/screens/ask";

/** Development-only gallery: the honest shape when a required tool returned unknown. */
export default function ShowcaseAskUnknownPage() {
  return <AskScreen model={fixtureAskUnknown} />;
}
