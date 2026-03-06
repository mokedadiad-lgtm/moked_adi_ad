import { getCategories, getProofreaderTypes, getTeamProfiles } from "@/app/admin/actions";
import { TeamTable } from "@/components/admin/team-table";

export default async function AdminTeamPage() {
  const [profiles, categories, proofreaderTypes] = await Promise.all([
    getTeamProfiles(),
    getCategories(),
    getProofreaderTypes(),
  ]);

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200/80 pb-4 text-start">
        <h1 className="text-2xl font-bold text-slate-800">ניהול צוות המוקד</h1>
        <p className="mt-1 text-sm text-slate-500">משיבים, מגיהים ועורכים לשוניים</p>
      </header>
      <TeamTable
        profiles={profiles}
        categories={categories}
        proofreaderTypes={proofreaderTypes}
      />
    </div>
  );
}
