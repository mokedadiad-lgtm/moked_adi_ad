import { listPendingTeamJoinSubmissions, listTeamJoinTokens } from "@/app/admin/team-join-actions";
import { getCategories, getProofreaderTypes, getTeamProfiles, getTopicsWithSubTopics } from "@/app/admin/actions";
import { TeamJoinAdminSection } from "@/components/admin/team-join-admin-section";
import { TeamTable } from "@/components/admin/team-table";
import { PageHeader } from "@/components/page-header";

export default async function AdminTeamPage() {
  const [profiles, categories, proofreaderTypes, topics, pendingJoin, joinTokens] = await Promise.all([
    getTeamProfiles(),
    getCategories(),
    getProofreaderTypes(),
    getTopicsWithSubTopics(),
    listPendingTeamJoinSubmissions(),
    listTeamJoinTokens(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="ניהול צוות המוקד"
        subtitle="משיבים, מגיהים ועורכים לשוניים — טפסי הצטרפות עצמית (הפקת קישורים ובקשות לאישור) מופיעים בראש הדף, מתחת לכותרת זו."
      />
      <TeamJoinAdminSection initialPending={pendingJoin} initialTokens={joinTokens} />
      <TeamTable
        profiles={profiles}
        categories={categories}
        proofreaderTypes={proofreaderTypes}
        topics={topics}
      />
    </div>
  );
}
