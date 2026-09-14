import { ProfileScreen } from "@/components/screens/profile/ProfileScreen";
import { NotConfigured } from "@/components/shell/NotConfigured";
import { readApi } from "@/lib/api/client";
import type { ProfileRead } from "@/lib/api/contracts";
import { toProfileScreenModel } from "@/lib/presentation/adapters/profile";
import { emptyProfile } from "@/lib/presentation/screens/profile";

type Props = { searchParams: Promise<{ error?: string | string[] }> };

/**
 * Live Profile route (TASK-050). Reads `GET /api/v1/profile` on the server: the pilot's party,
 * or the honest unset state — never a fabricated default. No eligibility conclusion is computed
 * here; that is TASK-035/051, and the eligibility card keeps the existing "No eligibility
 * decision yet" wording behind its own link.
 */
export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: Props) {
  const { error } = await searchParams;
  const errorParam = Array.isArray(error) ? error[0] : error;
  const result = await readApi<ProfileRead>("/api/v1/profile");
  if (!result.ok) {
    if (result.reason === "not_configured")
      return <NotConfigured title="Profile" />;
    return <ProfileScreen model={{ ...emptyProfile, status: "error" }} />;
  }
  return (
    <ProfileScreen model={toProfileScreenModel(result.value, errorParam)} />
  );
}
