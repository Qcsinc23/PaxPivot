import { EligibilityDetailScreen } from "@/components/screens/profile/EligibilityDetailScreen";
import { fixtureEligibilityDetail } from "@/lib/presentation/screens/profile";

/** Development-only gallery: eligibility detail rendered from its synthetic fixture. */
export default function ShowcaseEligibilityPage() {
  return <EligibilityDetailScreen model={fixtureEligibilityDetail} />;
}
