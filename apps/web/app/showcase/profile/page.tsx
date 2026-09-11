import { ProfileScreen } from "@/components/screens/profile/ProfileScreen";
import { fixtureProfile } from "@/lib/presentation/screens/profile";

/** Development-only gallery: the Profile surface rendered from its synthetic fixture. */
export default function ShowcaseProfilePage() {
  return <ProfileScreen model={fixtureProfile} />;
}
