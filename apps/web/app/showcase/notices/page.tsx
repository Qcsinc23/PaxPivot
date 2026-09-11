import { ConflictNotice } from "@/components/paxpivot/notices/ConflictNotice";
import { HonestAbsencePanel } from "@/components/paxpivot/notices/HonestAbsencePanel";
import { KeptResultNotice } from "@/components/paxpivot/notices/KeptResultNotice";
import { LateCheckNotice } from "@/components/paxpivot/notices/LateCheckNotice";
import { NotRankedNotice } from "@/components/paxpivot/notices/NotRankedNotice";
import { RefreshNotice } from "@/components/paxpivot/notices/RefreshNotice";
import { AppHeader } from "@/components/ui/AppHeader";
import { fixtureNotices } from "@/lib/presentation/notices";

/** Development-only gallery: every source-state notice rendered from its synthetic fixture. */
export default function ShowcaseNoticesPage() {
  return (
    <>
      <AppHeader
        title="Source-state notices"
        subtitle="Synthetic fixtures · never real terminals or checks"
        back={{ href: "/" }}
      />
      <RefreshNotice notice={fixtureNotices.refresh} />
      <KeptResultNotice notice={fixtureNotices.kept} />
      <LateCheckNotice notice={fixtureNotices.late} />
      <ConflictNotice notice={fixtureNotices.conflict} />
      <NotRankedNotice notice={fixtureNotices.notRanked} />
      <HonestAbsencePanel absence={fixtureNotices.absence} />
    </>
  );
}
