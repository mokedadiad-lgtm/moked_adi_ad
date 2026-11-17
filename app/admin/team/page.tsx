import { listPendingTeamJoinSubmissions, listTeamJoinTokens } from "@/app/admin/team-join-actions";
import {
  getDualProofreadersConfig,
  getProofreaderTypes,
  getTeamProfiles,
  getTopicsWithSubTopics,
} from "@/app/admin/actions";
import { DualProofreadersSettings } from "@/components/admin/dual-proofreaders-settings";
import { TeamJoinAdminSection } from "@/components/admin/team-join-admin-section";
import { TeamTable } from "@/components/admin/team-table";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const [profiles, proofreaderTypes, topics, pendingJoin, joinTokens, dualProofreaders] =
    await Promise.all([
      getTeamProfiles(),
      getProofreaderTypes(),
      getTopicsWithSubTopics(),
      listPendingTeamJoinSubmissions(),
      listTeamJoinTokens(),
      getDualProofreadersConfig(),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="ניהול צוות המוקד"
        subtitle="משיבים, מגיהים ועורכים לשוניים — טפסי הצטרפות עצמית (הפקת קישורים ובקשות לאישור) מופיעים בראש הדף, מתחת לכותרת זו."
      />
      <TeamJoinAdminSection initialPending={pendingJoin} initialTokens={joinTokens} />
      <DualProofreadersSettings initial={dualProofreaders} proofreaders={profiles} />
      <TeamTable profiles={profiles} proofreaderTypes={proofreaderTypes} topics={topics} />
    </div>
  );
}
