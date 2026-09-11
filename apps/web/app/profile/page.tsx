import { ProfileScreen } from "@/components/screens/profile/ProfileScreen";
import { emptyProfile } from "@/lib/presentation/screens/profile";

/**
 * Live Profile route. No profile API contract exists yet, so this renders the honest empty state
 * and never synthetic eligibility, party or readiness data.
 */
export default function ProfilePage() {
  return <ProfileScreen model={emptyProfile} />;
}
