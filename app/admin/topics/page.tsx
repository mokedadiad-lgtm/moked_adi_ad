import {
  getProofreaderTypes,
  getTopicsWithSubTopics,
} from "@/app/admin/actions";
import { TopicsManager } from "@/components/admin/topics-manager";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function AdminTopicsPage() {
  const [proofreaderTypes, topics] = await Promise.all([
    getProofreaderTypes(),
    getTopicsWithSubTopics(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="נושאים וסוגי הגהות" subtitle="ניהול נושאים, תת־נושאים וסוגי מגיהים" />
      <TopicsManager
        proofreaderTypes={proofreaderTypes}
        topics={topics}
      />
    </div>
  );
}
