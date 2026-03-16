import { getCategories, getProofreaderTypes, getTeamProfiles, getTopicsWithSubTopics } from "@/app/admin/actions";
import { TeamTable } from "@/components/admin/team-table";
import { PageHeader } from "@/components/page-header";

export default async function AdminTeamPage() {
  const [profiles, categories, proofreaderTypes, topics] = await Promise.all([
    getTeamProfiles(),
    getCategories(),
    getProofreaderTypes(),
    getTopicsWithSubTopics(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="ניהול צוות המוקד" subtitle="משיבים, מגיהים ועורכים לשוניים" />
      <TeamTable
        profiles={profiles}
        categories={categories}
        proofreaderTypes={proofreaderTypes}
        topics={topics}
      />
    </div>
  );
}
