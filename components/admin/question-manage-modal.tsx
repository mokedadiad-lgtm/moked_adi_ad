"use client";

import {
  assignQuestion,
  createSubTopic,
  createTopic,
  getProofreaderTypes,
  getTopicsWithSubTopics,
} from "@/app/admin/actions";
import type { RespondentOption, TopicOption } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { QuestionRow } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const GENDER_LABEL: Record<string, string> = { M: "זכר", F: "נקבה" };
const RESPONSE_LABEL: Record<string, string> = {
  short: "קצר ולעניין",
  detailed: "תשובה מפורטת",
};
const PUB_LABEL: Record<string, string> = {
  publish: "מסכימה לפרסם",
  blur: "מסכימה בטשטוש נתונים",
  none: "לא לפרסום",
};

interface QuestionManageModalProps {
  question: QuestionRow | null;
  respondents: RespondentOption[];
  topics: TopicOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuestionManageModal({
  question,
  respondents,
  topics,
  open,
  onOpenChange,
}: QuestionManageModalProps) {
  const router = useRouter();
  const [respondentId, setRespondentId] = useState("");
  const [topicId, setTopicId] = useState<string>("");
  const [subTopicId, setSubTopicId] = useState<string>("");
  const [topicsList, setTopicsList] = useState<TopicOption[]>(topics);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAddTopic, setShowAddTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicTypeId, setNewTopicTypeId] = useState("");
  const [proofreaderTypes, setProofreaderTypes] = useState<{ id: string; name_he: string }[]>([]);
  const [addTopicPending, setAddTopicPending] = useState(false);

  const [showAddSubTopic, setShowAddSubTopic] = useState(false);
  const [newSubTopicName, setNewSubTopicName] = useState("");
  const [addSubTopicPending, setAddSubTopicPending] = useState(false);

  const selectedTopic = topicsList.find((t) => t.id === topicId);
  const subTopics = selectedTopic?.sub_topics ?? [];

  const loadProofreaderTypes = async () => {
    const list = await getProofreaderTypes();
    setProofreaderTypes(list);
    if (list.length && !newTopicTypeId) setNewTopicTypeId(list[0].id);
  };

  const handleAddTopic = async () => {
    if (!newTopicName.trim() || !newTopicTypeId) return;
    setAddTopicPending(true);
    setError(null);
    const result = await createTopic({
      name_he: newTopicName.trim(),
      proofreader_type_id: newTopicTypeId,
    });
    setAddTopicPending(false);
    if (result.ok) {
      const updated = await getTopicsWithSubTopics();
      setTopicsList(updated);
      setTopicId(result.id);
      setSubTopicId("");
      setNewTopicName("");
      setShowAddTopic(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const handleAddSubTopic = async () => {
    if (!newSubTopicName.trim() || !topicId) return;
    setAddSubTopicPending(true);
    setError(null);
    const result = await createSubTopic({ topic_id: topicId, name_he: newSubTopicName.trim() });
    setAddSubTopicPending(false);
    if (result.ok) {
      const updated = await getTopicsWithSubTopics();
      setTopicsList(updated);
      setSubTopicId(result.id);
      setNewSubTopicName("");
      setShowAddSubTopic(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const handleSubmit = async () => {
    if (!question || !respondentId) return;
    setPending(true);
    setError(null);
    const result = await assignQuestion(
      question.id,
      respondentId,
      topicId || undefined,
      subTopicId || undefined
    );
    setPending(false);
    if (result.ok) {
      onOpenChange(false);
      setRespondentId("");
      setTopicId("");
      setSubTopicId("");
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  useEffect(() => {
    if (open) setTopicsList(topics);
  }, [open, topics]);

  useEffect(() => {
    if (question && open) {
      setTopicId(question.topic_id ?? "");
      setSubTopicId(question.sub_topic_id ?? "");
    }
  }, [question?.id, open, question?.topic_id, question?.sub_topic_id]);

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-2xl flex-col gap-4 overflow-hidden" dir="rtl">
        <DialogHeader className="shrink-0">
          <DialogTitle>ניהול משימה</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 text-right">
          <div className="space-y-1">
            {question.title && <p className="text-sm font-medium text-slate-800">{question.title}</p>}
            <p className="text-sm font-medium text-primary">תוכן השאלה</p>
            <ScrollArea className="h-[140px] rounded-xl border border-card-border bg-slate-50 p-3 text-sm text-slate-700">
              <div className="whitespace-pre-wrap text-right">{question.content}</div>
            </ScrollArea>
          </div>

          <div className="grid grid-cols-2 gap-3 text-right text-sm">
            <div>
              <p className="text-xs text-slate-500">גיל השואלת</p>
              <p className="font-medium text-primary">{question.asker_age ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">מגדר</p>
              <p className="font-medium text-primary">
                {question.asker_gender ? GENDER_LABEL[question.asker_gender] ?? "—" : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">מסלול נבחר</p>
              <p className="font-medium text-primary">
                {question.response_type ? RESPONSE_LABEL[question.response_type] ?? "—" : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">הסכמת פרסום</p>
              <p className="font-medium text-primary">
                {question.publication_consent ? PUB_LABEL[question.publication_consent] ?? "—" : "—"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>נושא ותת-נושא (לשיבוץ מגיהים)</Label>
            <div className="flex flex-wrap items-end gap-2">
              <Select value={topicId || "__none__"} onValueChange={(v) => { setTopicId(v === "__none__" ? "" : v); setSubTopicId(""); }}>
                <SelectTrigger className="min-w-[160px] text-right">
                  <SelectValue placeholder="בחר/י נושא" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא נושא</SelectItem>
                  {topicsList.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name_he}
                      {t.proofreader_type_name_he ? ` (${t.proofreader_type_name_he})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowAddTopic(true); loadProofreaderTypes(); }}>
                הוסף נושא
              </Button>
            </div>
            {showAddTopic && (
              <div className="rounded-xl border border-card-border bg-slate-50 p-3 space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label>שם נושא</Label>
                    <Input
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                      placeholder="שם הנושא"
                      className="min-w-[140px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>סוג הגהה</Label>
                    <Select value={newTopicTypeId} onValueChange={setNewTopicTypeId}>
                      <SelectTrigger className="min-w-[120px] text-right">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {proofreaderTypes.map((pt) => (
                          <SelectItem key={pt.id} value={pt.id}>{pt.name_he}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" onClick={handleAddTopic} disabled={addTopicPending || !newTopicName.trim()}>
                    {addTopicPending ? "שומר…" : "שמור"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAddTopic(false); setNewTopicName(""); }}>
                    ביטול
                  </Button>
                </div>
              </div>
            )}

            {topicId && (
              <div className="flex flex-wrap items-end gap-2 mt-1">
                <Select value={subTopicId || "__none__"} onValueChange={(v) => setSubTopicId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="min-w-[160px] text-right">
                    <SelectValue placeholder="בחר/י תת-נושא" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא תת-נושא</SelectItem>
                    {subTopics.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name_he}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddSubTopic(true)}>
                  הוסף תת-נושא
                </Button>
              </div>
            )}
            {showAddSubTopic && topicId && (
              <div className="rounded-xl border border-card-border bg-slate-50 p-3 flex flex-wrap items-end gap-2 mt-1">
                <div className="space-y-1">
                  <Label>שם תת-נושא</Label>
                  <Input
                    value={newSubTopicName}
                    onChange={(e) => setNewSubTopicName(e.target.value)}
                    placeholder="שם התת-נושא"
                    className="min-w-[140px]"
                  />
                </div>
                <Button size="sm" onClick={handleAddSubTopic} disabled={addSubTopicPending || !newSubTopicName.trim()}>
                  {addSubTopicPending ? "שומר…" : "שמור"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowAddSubTopic(false); setNewSubTopicName(""); }}>
                  ביטול
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>שיבוץ למשיב/ה</Label>
            {respondents.length === 0 ? (
              <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 p-3 text-sm text-amber-800">
                אין משיבים במערכת
              </p>
            ) : (
              <Select value={respondentId} onValueChange={setRespondentId}>
                <SelectTrigger className="w-full text-right">
                  <SelectValue placeholder="בחר/י משיב/ה" />
                </SelectTrigger>
                <SelectContent>
                  {respondents.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.full_name_he || `משיב (${r.id.slice(0, 8)}…)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>
          )}
        </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            type="button"
            variant="default"
            className="bg-primary"
            onClick={handleSubmit}
            disabled={pending || respondents.length === 0 || !respondentId}
          >
            {pending ? "שומר…" : "שמור ושלח למשיב"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
