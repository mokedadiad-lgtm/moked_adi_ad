import {
  getAnalyticsByTopic,
  getAnalyticsChartData,
  getAnalyticsFilteredQuestions,
  getProofreadersList,
  getRespondents,
  getTopicsWithSubTopics,
} from "@/app/admin/actions";
import { PageHeader } from "@/components/page-header";
import { AnalyticsView } from "@/components/admin/analytics-view";

export const revalidate = 0;

/** דיאגרמות תמיד לפי 100 ימים אחרונים, בלי סינון נושא/משיב/וכו׳ */
const CHART_DAYS = 100;

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string;
    topicId?: string;
    subTopicId?: string;
    respondentId?: string;
    proofreaderId?: string;
    email?: string;
  }>;
}) {
  const params = await searchParams;
  const days = Math.min(365, Math.max(1, parseInt(params.days ?? "100", 10) || 100));
  const tableFilters = {
    days,
    topicId: params.topicId?.trim() || null,
    subTopicId: params.subTopicId?.trim() || null,
    respondentId: params.respondentId?.trim() || null,
    proofreaderId: params.proofreaderId?.trim() || null,
    emailFilter: params.email?.trim() || null,
  };

  const chartFilters = { days: CHART_DAYS };

  const [
    chartData,
    topicData,
    filteredQuestions,
    topics,
    respondents,
    proofreaders,
  ] = await Promise.all([
    getAnalyticsChartData(chartFilters),
    getAnalyticsByTopic(chartFilters),
    getAnalyticsFilteredQuestions(tableFilters),
    getTopicsWithSubTopics(),
    getRespondents(),
    getProofreadersList(),
  ]);

  const subTopics = topics.flatMap((t) => t.sub_topics ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="נתונים ודיאגרמות"
        subtitle="סינון וניתוח לפי נושאים, תאריכים, משיבים, מגיהים ואימייל"
      />
      <AnalyticsView
        chartData={chartData}
        topicData={topicData}
        filteredQuestions={filteredQuestions}
        topics={topics}
        subTopics={subTopics}
        respondents={respondents}
        proofreaders={proofreaders}
        initialFilters={{
          days: tableFilters.days,
          topicId: tableFilters.topicId,
          subTopicId: tableFilters.subTopicId,
          respondentId: tableFilters.respondentId,
          proofreaderId: tableFilters.proofreaderId,
          email: tableFilters.emailFilter ?? undefined,
        }}
      />
    </div>
  );
}
