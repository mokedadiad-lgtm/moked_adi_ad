import { getEmailCounts, getProofreaderTypes, getTopicsWithSubTopics } from "@/app/admin/actions";
import { PageHeader } from "@/components/page-header";
import { getActiveQuestions } from "@/lib/admin-active-questions";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const revalidate = 0;

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const params = await searchParams;
  const [questions, topics, proofreaderTypes] = await Promise.all([
    getActiveQuestions(),
    getTopicsWithSubTopics(),
    getProofreaderTypes(),
  ]);

  const uniqueEmails = [...new Set(questions.map((r) => (r.asker_email ?? "").trim().toLowerCase()).filter(Boolean))];
  const emailCounts = uniqueEmails.length > 0 ? await getEmailCounts(uniqueEmails) : {};

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="לוח בקרה"
        subtitle="סקירה וניהול משימות פעילות"
        compact
        className="static z-auto rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50/90 to-background shadow-sm shadow-slate-200/30 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80"
      />
      <AdminDashboard
        questions={questions}
        topics={topics}
        proofreaderTypes={proofreaderTypes}
        initialOpenQuestionId={params.open ?? undefined}
        emailCounts={emailCounts}
      />
    </div>
  );
}
