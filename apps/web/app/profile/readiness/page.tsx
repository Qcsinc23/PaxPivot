import { ReadinessScreen } from "@/components/screens/profile/ReadinessScreen";
import { emptyProfile } from "@/lib/presentation/screens/profile";

/** Live readiness route: the honest empty state until a profile API contract exists. */
export default function ReadinessPage() {
  return (
    <ReadinessScreen
      status={emptyProfile.status}
      model={emptyProfile.readiness}
      backHref="/profile"
    />
  );
}
