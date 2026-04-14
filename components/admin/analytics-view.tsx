"use client";

import type {
  AnalyticsChartData,
  AnalyticsDayRow,
  AnalyticsQuestionRow,
  AnalyticsTopicRow,
  RespondentOption,
  TopicOption,
  WhatsAppAnalyticsData,
} from "@/app/admin/actions";
import type { SubTopicOption } from "@/app/admin/actions";
import { STAGE_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { afterModalClose } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

interface AnalyticsViewProps {
  chartData: AnalyticsChartData;
  whatsappData: WhatsAppAnalyticsData;
  topicData?: AnalyticsTopicRow[];
  filteredQuestions?: AnalyticsQuestionRow[];
  topics: TopicOption[];
  subTopics: SubTopicOption[];
  respondents: RespondentOption[];
  proofreaders: RespondentOption[];
  initialFilters: {
    days?: number;
    topicId?: string | null;
    subTopicId?: string | null;
    respondentId?: string | null;
    proofreaderId?: string | null;
    email?: string;
  };
}

const CHART_HEIGHT = 200;
const BAR_GAP = 6;
const MAX_BAR_LABELS = 8;

const PIE_COLORS = [
  "#d81b60", "#059669", "#dc2626", "#d97706", "#7c3aed",
  "#0d9488", "#ea580c", "#2563eb", "#ca8a04", "#9333ea",
];

function BarChart({
  data,
  title,
  barColor = "bg-primary",
  accentColor = "text-primary",
  maxBars = 60,
}: {
  data: AnalyticsDayRow[];
  title: string;
  barColor?: string;
  accentColor?: string;
  maxBars?: number;
}) {
  const display = data.length > maxBars ? data.slice(-maxBars) : data;
  const total = data.reduce((s, d) => s + d.count, 0);
  const max = Math.max(1, ...display.map((d) => d.count));
  const hasData = total > 0;

  const step = Math.max(1, Math.floor(display.length / MAX_BAR_LABELS));
  const labelIndices = new Set(
    Array.from({ length: MAX_BAR_LABELS }, (_, i) =>
      Math.min(i * step, display.length - 1)
    )
  );
  if (display.length > 0) labelIndices.add(display.length - 1);

  return (
    <div className="space-y-3">
      <h3 className={`text-sm font-semibold ${accentColor}`}>{title}</h3>
      <div
        className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/70 p-4"
        style={{ minHeight: CHART_HEIGHT + 48 }}
      >
        {hasData ? (
          <>
            {/* Y-axis grid */}
            <div
              className="font-sans absolute inset-x-4 top-4 bottom-10 flex flex-col justify-between border-slate-200/60 pr-2 text-end"
              style={{ borderRightWidth: 1 }}
              aria-hidden
            >
              {[max, Math.ceil(max * 0.66), Math.ceil(max * 0.33), 0].filter(
                (v, i, arr) => arr.indexOf(v) === i
              ).sort((a, b) => b - a).map((tick) => (
                <span key={tick} className="text-[10px] text-slate-400 tabular-nums">
                  {tick}
                </span>
              ))}
            </div>
            {/* Bars area */}
            <div
              className="flex items-end gap-[6px] pr-12 pt-1"
              style={{
                height: CHART_HEIGHT,
                marginRight: "2.5rem",
              }}
              dir="ltr"
            >
              {display.map((d) => (
                <div
                  key={d.date}
                  className="group relative flex flex-1 min-w-0 flex-col items-center"
                  title={`${d.date}: ${d.count}`}
                >
                  <div
                    className={`w-full max-w-[20px] rounded-t-md ${barColor} shadow-sm transition-all duration-200 group-hover:opacity-90`}
                    style={{
                      height: `${Math.max((d.count / max) * (CHART_HEIGHT - 8), d.count > 0 ? 6 : 0)}px`,
                      minWidth: 6,
                    }}
                  />
                </div>
              ))}
            </div>
            {/* X-axis labels */}
            <div
              className="font-sans mt-2 flex justify-between gap-1 pr-12 text-[10px] text-slate-500"
              style={{ marginRight: "2.5rem" }}
              dir="ltr"
            >
              {display.map((d, i) =>
                labelIndices.has(i) ? (
                  <span key={d.date} className="shrink-0 truncate">
                    {d.date.slice(5)}
                  </span>
                ) : (
                  <span key={d.date} className="invisible shrink-0 truncate">
                    {d.date.slice(5)}
                  </span>
                )
              )}
            </div>
            {/* Summary */}
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-200/60 pt-3">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                סה״כ: {total}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                מקס ליום: {max}
              </span>
            </div>
          </>
        ) : (
          <div
            className="flex flex-col items-center justify-center rounded-lg bg-slate-100/50 py-12 text-center"
            style={{ minHeight: CHART_HEIGHT }}
          >
            <p className="text-sm font-medium text-slate-500">אין נתונים בתקופה זו</p>
            <p className="mt-1 text-xs text-slate-400">נסו להרחיב את התקופה או לשנות את הסינון</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PieChart({ data }: { data: AnalyticsTopicRow[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const hasData = total > 0;
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/70 py-16 text-center">
        <p className="text-sm font-medium text-slate-500">אין נתונים לפי נושא</p>
      </div>
    );
  }
  let acc = 0;
  const segments = data.map((d, i) => {
    const pct = d.count / total;
    const start = acc;
    acc += pct;
    return { ...d, start: start * 360, end: acc * 360, color: PIE_COLORS[i % PIE_COLORS.length] };
  });
  const conic = segments.map((s) => `${s.color} ${s.start}deg ${s.end}deg`).join(", ");
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div
        className="h-52 w-52 shrink-0 rounded-full border-4 border-white shadow-lg"
        style={{ background: `conic-gradient(${conic})` }}
        aria-hidden
      />
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.topic_id ?? "none"} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            <span className="truncate font-medium text-slate-700">{d.topic_name_he}</span>
            <span className="shrink-0 text-slate-500">
              {d.count} ({total > 0 ? Math.round((d.count / total) * 100) : 0}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CombinedInOutChart({
  createdByDay,
  sentByDay,
  maxBars = 50,
}: {
  createdByDay: AnalyticsDayRow[];
  sentByDay: AnalyticsDayRow[];
  maxBars?: number;
}) {
  const createdMap = Object.fromEntries(createdByDay.map((d) => [d.date, d.count]));
  const sentMap = Object.fromEntries(sentByDay.map((d) => [d.date, d.count]));
  const allDates = [...new Set([...createdByDay.map((d) => d.date), ...sentByDay.map((d) => d.date)])].sort();
  const display = allDates.length > maxBars ? allDates.slice(-maxBars) : allDates;
  const maxVal = Math.max(
    1,
    ...display.flatMap((d) => [createdMap[d] ?? 0, sentMap[d] ?? 0])
  );
  const totalIn = createdByDay.reduce((s, d) => s + d.count, 0);
  const totalOut = sentByDay.reduce((s, d) => s + d.count, 0);
  const step = Math.max(1, Math.floor(display.length / MAX_BAR_LABELS));
  const labelIndices = new Set(
    Array.from({ length: MAX_BAR_LABELS }, (_, i) => Math.min(i * step, display.length - 1))
  );
  if (display.length > 0) labelIndices.add(display.length - 1);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">שאלות שנכנסו vs תשובות שיצאו</h3>
      <div
        className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/70 p-4"
        style={{ minHeight: CHART_HEIGHT + 48 }}
      >
        <div
          className="font-sans absolute inset-x-4 top-4 bottom-10 flex flex-col justify-between border-slate-200/60 pr-2 text-end"
          style={{ borderRightWidth: 1 }}
          aria-hidden
        >
          {[maxVal, Math.ceil(maxVal * 0.5), 0]
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .sort((a, b) => b - a)
            .map((tick) => (
              <span key={tick} className="text-[10px] text-slate-400 tabular-nums">
                {tick}
              </span>
            ))}
        </div>
        <div
          className="flex items-end gap-1 pr-12 pt-1"
          style={{ height: CHART_HEIGHT, marginRight: "2.5rem" }}
          dir="ltr"
        >
          {display.map((date) => {
            const inVal = createdMap[date] ?? 0;
            const outVal = sentMap[date] ?? 0;
            return (
              <div key={date} className="group flex flex-1 min-w-0 flex-col items-center gap-0.5">
                <div className="flex w-full max-w-[28px] gap-1">
                  <div
                    className="flex-1 min-w-0 rounded-t-md bg-blue-500 shadow-sm transition-all group-hover:opacity-90"
                    style={{
                      height: `${Math.max((inVal / maxVal) * (CHART_HEIGHT - 8), inVal > 0 ? 6 : 0)}px`,
                      minWidth: 6,
                    }}
                    title={`${date}: נכנסו ${inVal}`}
                  />
                  <div
                    className="flex-1 min-w-0 rounded-t-md bg-emerald-500 shadow-sm transition-all group-hover:opacity-90"
                    style={{
                      height: `${Math.max((outVal / maxVal) * (CHART_HEIGHT - 8), outVal > 0 ? 6 : 0)}px`,
                      minWidth: 6,
                    }}
                    title={`${date}: יצאו ${outVal}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div
          className="font-sans mt-2 flex justify-between gap-1 pr-12 text-[10px] text-slate-500"
          style={{ marginRight: "2.5rem" }}
          dir="ltr"
        >
          {display.map((date, i) =>
            labelIndices.has(i) ? (
              <span key={date} className="shrink-0 truncate">
                {date.slice(5)}
              </span>
            ) : (
              <span key={date} className="invisible shrink-0 truncate">
                {date.slice(5)}
              </span>
            )
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-200/60 pt-3">
          <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            נכנסו: {totalIn}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            יצאו: {totalOut}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsView({
  chartData,
  whatsappData,
  topicData = [],
  filteredQuestions = [],
  topics,
  subTopics,
  respondents,
  proofreaders,
  initialFilters,
}: AnalyticsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [detailQuestion, setDetailQuestion] = useState<AnalyticsQuestionRow | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const applyFilters = useCallback(
    (updates: Record<string, string | number | undefined | null>) => {
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      router.replace(`/admin/analytics?${next.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="font-sans space-y-6" dir="rtl">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">סינון לטבלת הנתונים</CardTitle>
          <p className="text-xs text-slate-500">הסינון משפיע רק על הטבלה למטה. הדיאגרמות מוצגות בנפרד (100 ימים אחרונים).</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">תקופה (ימים)</Label>
            <Select
              value={String(initialFilters.days ?? 100)}
              onValueChange={(v) => applyFilters({ days: v })}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="60">60</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="180">180</SelectItem>
                <SelectItem value="365">365</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">נושא</Label>
            <Select
              value={initialFilters.topicId ?? "all"}
              onValueChange={(v) =>
                applyFilters({ topicId: v === "all" ? null : v, subTopicId: null })
              }
            >
              <SelectTrigger className="min-w-[140px]">
                <SelectValue placeholder="הכל" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name_he}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">תת־נושא</Label>
            <Select
              value={initialFilters.subTopicId ?? "all"}
              onValueChange={(v) => applyFilters({ subTopicId: v === "all" ? null : v })}
            >
              <SelectTrigger className="min-w-[140px]">
                <SelectValue placeholder="הכל" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                {subTopics
                  .filter(
                    (s) =>
                      !initialFilters.topicId || s.topic_id === initialFilters.topicId
                  )
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name_he}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">משיב/ה</Label>
            <Select
              value={initialFilters.respondentId ?? "all"}
              onValueChange={(v) => applyFilters({ respondentId: v === "all" ? null : v })}
            >
              <SelectTrigger className="min-w-[140px]">
                <SelectValue placeholder="הכל" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                {respondents.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.full_name_he || r.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">מגיה/ה</Label>
            <Select
              value={initialFilters.proofreaderId ?? "all"}
              onValueChange={(v) => applyFilters({ proofreaderId: v === "all" ? null : v })}
            >
              <SelectTrigger className="min-w-[140px]">
                <SelectValue placeholder="הכל" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                {proofreaders.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.full_name_he || r.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">אימייל שואל (מכיל)</Label>
            <Input
              key={`email-${initialFilters.email ?? ""}`}
              placeholder="סינון לפי אימייל..."
              defaultValue={initialFilters.email ?? ""}
              className="w-48"
              dir="ltr"
              onBlur={(e) => applyFilters({ email: e.target.value.trim() || null })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applyFilters({ email: (e.target as HTMLInputElement).value.trim() || null });
                }
              }}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.replace("/admin/analytics", { scroll: false })
              }
            >
              נקה סינון
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-slate-800">
            טבלת נתונים ({filteredQuestions.length} שאלות)
          </CardTitle>
          <p className="text-xs text-slate-500">תוצאות לפי הסינון למעלה — תקופה: {initialFilters.days ?? 100} ימים אחרונים</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="!bg-slate-50/90 odd:!bg-slate-50/90 even:!bg-slate-50/90 hover:!bg-slate-50/90">
                <TableHead className="text-xs font-semibold text-slate-800">ID</TableHead>
                <TableHead className="text-xs font-semibold text-slate-800">כותרת</TableHead>
                <TableHead className="text-xs font-semibold text-slate-800">נושא</TableHead>
                <TableHead className="text-xs font-semibold text-slate-800">תת־נושא</TableHead>
                <TableHead className="text-xs font-semibold text-slate-800">סטטוס</TableHead>
                <TableHead className="text-xs font-semibold text-slate-800">משיב/ה</TableHead>
                <TableHead className="text-xs font-semibold text-slate-800">מגיה/ה</TableHead>
                <TableHead className="text-xs font-semibold text-slate-800">תאריך כניסה</TableHead>
                <TableHead className="text-xs font-semibold text-slate-800">תאריך שליחה</TableHead>
                <TableHead className="text-xs font-semibold text-slate-800">אימייל שואל</TableHead>
                <TableHead className="text-xs font-semibold text-slate-800">סוג תשובה</TableHead>
                <TableHead className="text-xs font-semibold text-slate-800">פרסום</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuestions.length === 0 ? (
                <TableRow className="border-0 !bg-transparent odd:!bg-transparent even:!bg-transparent hover:!bg-transparent">
                  <TableCell colSpan={12} className="py-8 text-center text-slate-500">
                    אין שאלות התואמות את הסינון
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuestions.map((q) => (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer text-xs transition-colors hover:bg-slate-100/70 motion-reduce:transition-none"
                    onClick={() => {
                      setDetailQuestion(q);
                      setDetailModalOpen(true);
                    }}
                  >
                    <TableCell className="font-mono text-slate-600">{q.short_id ?? q.id.slice(0, 8)}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={q.title ?? undefined}>{q.title || "—"}</TableCell>
                    <TableCell>{q.topic_name_he || "—"}</TableCell>
                    <TableCell>{q.sub_topic_name_he || "—"}</TableCell>
                    <TableCell>{STAGE_LABELS[q.stage]}</TableCell>
                    <TableCell>{q.respondent_name?.trim() || "—"}</TableCell>
                    <TableCell>{q.proofreader_name?.trim() || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">{q.created_at.slice(0, 10)}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">{q.sent_at ? q.sent_at.slice(0, 10) : "—"}</TableCell>
                    <TableCell className="max-w-[140px] truncate font-mono text-slate-600" dir="ltr">{q.asker_email || "—"}</TableCell>
                    <TableCell>{q.response_type === "short" ? "קצר" : q.response_type === "detailed" ? "מפורט" : "—"}</TableCell>
                    <TableCell>{q.publication_consent === "publish" ? "פרסום" : q.publication_consent === "blur" ? "טשטוש" : q.publication_consent === "none" ? "לא" : "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={detailModalOpen}
        onOpenChange={(open) => {
          setDetailModalOpen(open);
          if (!open) afterModalClose(() => setDetailQuestion(null));
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 px-0 pt-10 pb-0" dir="rtl">
          <DialogHeader className="shrink-0 px-4 sm:px-6">
            <DialogTitle>
              פרטי שאלה {detailQuestion?.short_id ?? detailQuestion?.id?.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          {detailQuestion && (
            <div className="min-h-0 w-full flex-1 overflow-y-auto">
            <div className="space-y-4 px-4 pb-1 text-sm sm:px-6">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <p className="text-slate-500">כותרת</p>
                <p className="font-medium text-slate-800">{detailQuestion.title || "—"}</p>
                <p className="text-slate-500">נושא</p>
                <p>{detailQuestion.topic_name_he || "—"}</p>
                <p className="text-slate-500">תת־נושא</p>
                <p>{detailQuestion.sub_topic_name_he || "—"}</p>
                <p className="text-slate-500">סטטוס</p>
                <p>{STAGE_LABELS[detailQuestion.stage]}</p>
                <p className="text-slate-500">משיב/ה</p>
                <p>{detailQuestion.respondent_name?.trim() || "—"}</p>
                <p className="text-slate-500">מגיה/ה</p>
                <p>{detailQuestion.proofreader_name?.trim() || "—"}</p>
                <p className="text-slate-500">תאריך כניסה</p>
                <p>{detailQuestion.created_at.slice(0, 10)}</p>
                <p className="text-slate-500">תאריך שליחה</p>
                <p>{detailQuestion.sent_at ? detailQuestion.sent_at.slice(0, 10) : "—"}</p>
                <p className="text-slate-500">אימייל שואל</p>
                <p className="font-mono" dir="ltr">{detailQuestion.asker_email || "—"}</p>
                <p className="text-slate-500">סוג תשובה</p>
                <p>{detailQuestion.response_type === "short" ? "קצר ולעניין" : detailQuestion.response_type === "detailed" ? "מפורט" : "—"}</p>
                <p className="text-slate-500">פרסום</p>
                <p>{detailQuestion.publication_consent === "publish" ? "מסכימ/ה לפרסם" : detailQuestion.publication_consent === "blur" ? "בטשטוש" : detailQuestion.publication_consent === "none" ? "לא לפרסום" : "—"}</p>
              </div>
              <div>
                <p className="mb-1 font-medium text-slate-600">תוכן השאלה</p>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-slate-700 whitespace-pre-wrap">
                  {detailQuestion.content || "—"}
                </div>
              </div>
            </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden border-slate-200/80 bg-gradient-to-b from-slate-50 to-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-slate-800">
            שאלות שנכנסו ותשובות שיצאו
          </CardTitle>
          <p className="text-xs text-slate-500">100 ימים אחרונים — כחול: כניסות, ירוק: שליחות (דיאגרמות לא תלויות בסינון)</p>
        </CardHeader>
        <CardContent>
          <CombinedInOutChart
            createdByDay={chartData.createdByDay}
            sentByDay={chartData.sentByDay}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="overflow-hidden border-slate-200/80 bg-gradient-to-b from-blue-50/40 to-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-800">
              שאלות שנכנסו למערכת (100 ימים)
            </CardTitle>
            <p className="text-xs text-slate-500">כניסות לפי יום</p>
          </CardHeader>
          <CardContent>
            <BarChart
              data={chartData.createdByDay}
              title="כניסות לפי יום"
              barColor="bg-blue-500"
              accentColor="text-blue-700"
            />
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-slate-200/80 bg-gradient-to-b from-emerald-50/40 to-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-800">
              תשובות שנשלחו לשואלים (100 ימים)
            </CardTitle>
            <p className="text-xs text-slate-500">שליחות לפי יום</p>
          </CardHeader>
          <CardContent>
            <BarChart
              data={chartData.sentByDay}
              title="שליחות לפי יום"
              barColor="bg-emerald-500"
              accentColor="text-emerald-700"
            />
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-slate-200/80 bg-gradient-to-b from-violet-50/40 to-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-slate-800">
            התפלגות לפי נושא (100 ימים)
          </CardTitle>
          <p className="text-xs text-slate-500">דיאגרמת עוגה — שאלות לפי נושא</p>
        </CardHeader>
        <CardContent>
          <PieChart data={topicData} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200/80 bg-gradient-to-b from-emerald-50/40 to-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-slate-800">נתוני WhatsApp</CardTitle>
          <p className="text-xs text-slate-500">מדדי הודעות, שיחות וביצועי בוט בתקופה המסוננת</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">הודעות נכנסות</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{whatsappData.kpis.inboundMessages}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">הודעות יוצאות</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{whatsappData.kpis.outboundMessages}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">שיחות (סה״כ)</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{whatsappData.kpis.totalConversations}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">שיחות שלא נקראו (Inbox)</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{whatsappData.kpis.unreadInboxConversations}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">התחילו בוט</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{whatsappData.kpis.botStarted}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">השלימו בוט</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{whatsappData.kpis.botCompleted}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">התחילו ולא השלימו</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{whatsappData.kpis.botNotCompleted}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">שיחות שמוצגות ב־Inbox</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{whatsappData.kpis.inboxVisibleConversations}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <BarChart
              data={whatsappData.inboundByDay}
              title="WhatsApp נכנסות לפי יום"
              barColor="bg-blue-500"
              accentColor="text-blue-700"
            />
            <BarChart
              data={whatsappData.outboundByDay}
              title="WhatsApp יוצאות לפי יום"
              barColor="bg-emerald-500"
              accentColor="text-emerald-700"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <BarChart
              data={whatsappData.botStartedByDay}
              title="התחלות תהליך בוט לפי יום"
              barColor="bg-fuchsia-500"
              accentColor="text-fuchsia-700"
            />
            <BarChart
              data={whatsappData.botCompletedByDay}
              title="השלמות תהליך בוט לפי יום"
              barColor="bg-amber-500"
              accentColor="text-amber-700"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
