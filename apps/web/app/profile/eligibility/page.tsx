import { EligibilityDetailScreen } from "@/components/screens/profile/EligibilityDetailScreen";
import { emptyEligibilityDetail } from "@/lib/presentation/screens/profile";

/** Live eligibility detail route: the honest empty state until a policy API exists. */
export default function EligibilityPage() {
  return <EligibilityDetailScreen model={emptyEligibilityDetail} />;
}
