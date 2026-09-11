import { AskScreen } from "@/components/screens/ask/AskScreen";
import { fixtureAsk } from "@/lib/presentation/screens/ask";

/** Development-only gallery: an answer rendered from its synthetic fixture. */
export default function ShowcaseAskPage() {
  return <AskScreen model={fixtureAsk} />;
}
