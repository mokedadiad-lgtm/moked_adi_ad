import {
  getProofreaderTypes,
  getTopicsWithSubTopics,
} from "@/app/admin/actions";
import { TopicsManager } from "@/components/admin/topics-manager";

export const dynamic = "force-dynamic";

export default async function AdminTopicsPage() {
  const [proofreaderTypes, topics] = await Promise.all([
    getProofreaderTypes(),
    getTopicsWithSubTopics(),
  ]);

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200/80 pb-4 text-start">
        <h1 className="text-2xl font-bold text-slate-800">נושאים וסוגי הגהות</h1>
        <p className="mt-1 text-sm text-slate-500">ניהול נושאים, תת־נושאים וסוגי מגיהים</p>
      </header>
      <TopicsManager
        proofreaderTypes={proofreaderTypes}
        topics={topics}
      />
    </div>
  );
}
