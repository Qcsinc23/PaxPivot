import { ReadinessScreen } from "@/components/screens/profile/ReadinessScreen";
import { fixtureProfile } from "@/lib/presentation/screens/profile";

/** Development-only gallery: the readiness checklist rendered from its synthetic fixture. */
export default function ShowcaseReadinessPage() {
  return (
    <ReadinessScreen
      status={fixtureProfile.status}
      model={fixtureProfile.readiness}
      backHref="/showcase/profile"
    />
  );
}
