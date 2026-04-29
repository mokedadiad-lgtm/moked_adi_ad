"use client";

import {
  createProofreaderType,
  createSubTopic,
  createTopic,
  deleteProofreaderType,
  deleteSubTopic,
  deleteTopic,
  getRespondents,
  getTopicRespondentIds,
  setTopicRespondents,
  updateProofreaderType,
  updateSubTopic,
  updateTopic,
} from "@/app/admin/actions";
import type { ProofreaderTypeOption, TopicOption } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoadingSpinner } from "@/components/ui/page-loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface TopicsManagerProps {
  proofreaderTypes: ProofreaderTypeOption[];
  topics: TopicOption[];
}

export function TopicsManager({
  proofreaderTypes,
  topics,
}: TopicsManagerProps) {
  const router = useRouter();
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeSlug, setNewTypeSlug] = useState("");
  const [editTypeId, setEditTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicTypeId, setNewTopicTypeId] = useState("");
  const [addSubTopicTopicId, setAddSubTopicTopicId] = useState<string | null>(null);
  const [newSubTopicName, setNewSubTopicName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // מודל שיוך משיבים (אחרי הוספת נושא או בלחיצה על נושא)
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTopicId, setAssignTopicId] = useState<string | null>(null);
  const [assignTopicName, setAssignTopicName] = useState("");
  const [assignSubTopics, setAssignSubTopics] = useState<TopicOption["sub_topics"]>([]);
  const [assignRespondentsList, setAssignRespondentsList] = useState<{ id: string; full_name_he: string | null }[]>([]);
  const [assignRespondentIds, setAssignRespondentIds] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [userGender, setUserGender] = useState<"M" | "F" | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<"type" | "topic" | "subtopic" | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const refresh = () => router.refresh();

  useEffect(() => {
    let cancelled = false;
    getSupabaseBrowser()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (!user || cancelled) return null;
        return getSupabaseBrowser().from("profiles").select("gender").eq("id", user.id).single();
      })
      .then((res) => {
        const gender = (res as { data?: { gender?: string } } | null)?.data?.gender;
        if (!cancelled && gender === "F") setUserGender("F");
        else if (!cancelled && gender === "M") setUserGender("M");
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // טעינת רשימת משיבים ומשויכים כשנפתח חלון השיוך
  useEffect(() => {
    if (!assignOpen || !assignTopicId) return;
    let cancelled = false;
    setAssignLoading(true);
    Promise.all([getRespondents(), getTopicRespondentIds(assignTopicId)])
      .then(([list, ids]) => {
        if (!cancelled) {
          setAssignRespondentsList(list);
          setAssignRespondentIds(ids);
        }
      })
      .finally(() => {
        if (!cancelled) setAssignLoading(false);
      });
    return () => { cancelled = true; };
  }, [assignOpen, assignTopicId]);

  const handleCreateType = async () => {
    if (!newTypeName.trim()) return;
    setPending(true);
    setError(null);
    const result = await createProofreaderType({
      name_he: newTypeName.trim(),
      slug: newTypeSlug.trim() || newTypeName.trim().replace(/\s+/g, "-"),
      sort_order: proofreaderTypes.length,
    });
    setPending(false);
    if (result.ok) {
      setAddTypeOpen(false);
      setNewTypeName("");
      setNewTypeSlug("");
      refresh();
    } else setError(result.error);
  };

  const handleUpdateType = async () => {
    if (!editTypeId) return;
    setPending(true);
    setError(null);
    const result = await updateProofreaderType(editTypeId, { name_he: editTypeName.trim() });
    setPending(false);
    if (result.ok) {
      setEditTypeId(null);
      refresh();
    } else setError(result.error);
  };

  const handleDeleteType = async (id: string) => {
    setPending(true);
    const result = await deleteProofreaderType(id);
    setPending(false);
    if (result.ok) {
      setDeleteConfirm(null);
      setDeleteConfirmId(null);
      refresh();
    } else setError(result.error);
  };

  const handleCreateTopic = async () => {
    if (!newTopicName.trim() || !newTopicTypeId) return;
    setPending(true);
    setError(null);
    const result = await createTopic({
      name_he: newTopicName.trim(),
      proofreader_type_id: newTopicTypeId,
    });
    setPending(false);
    if (result.ok) {
      const id = (result as { ok: true; id: string }).id;
      setAddTopicOpen(false);
      setNewTopicName("");
      setNewTopicTypeId(proofreaderTypes[0]?.id ?? "");
      setAssignTopicId(id);
      setAssignTopicName(newTopicName.trim());
      setAssignSubTopics([]);
      setAssignOpen(true);
      refresh();
    } else setError(result.error);
  };

  const handleCreateSubTopic = async () => {
    if (!addSubTopicTopicId || !newSubTopicName.trim()) return;
    setPending(true);
    setError(null);
    const result = await createSubTopic({
      topic_id: addSubTopicTopicId,
      name_he: newSubTopicName.trim(),
    });
    setPending(false);
    if (result.ok) {
      setAddSubTopicTopicId(null);
      setNewSubTopicName("");
      refresh();
    } else setError(result.error);
  };

  const handleDeleteTopic = async (id: string) => {
    setPending(true);
    const result = await deleteTopic(id);
    setPending(false);
    if (result.ok) {
      setDeleteConfirm(null);
      setDeleteConfirmId(null);
      refresh();
    } else setError(result.error);
  };

  const handleDeleteSubTopic = async (id: string) => {
    setPending(true);
    const result = await deleteSubTopic(id);
    setPending(false);
    if (result.ok) {
      setDeleteConfirm(null);
      setDeleteConfirmId(null);
      refresh();
    } else setError(result.error);
  };

  const runDeleteConfirm = () => {
    if (!deleteConfirmId) return;
    if (deleteConfirm === "type") handleDeleteType(deleteConfirmId);
    else if (deleteConfirm === "topic") handleDeleteTopic(deleteConfirmId);
    else if (deleteConfirm === "subtopic") handleDeleteSubTopic(deleteConfirmId);
  };

  const openAssignModal = (topic: TopicOption) => {
    setAssignTopicId(topic.id);
    setAssignTopicName(topic.name_he);
    setAssignSubTopics(topic.sub_topics ?? []);
    setAssignOpen(true);
  };

  const closeAssignModal = () => {
    setAssignOpen(false);
    setAssignTopicId(null);
    setAssignTopicName("");
    setAssignSubTopics([]);
    setAssignRespondentIds([]);
    setAssignRespondentsList([]);
  };

  const handleSaveAssignRespondents = async () => {
    if (!assignTopicId) return;
    setAssignSaving(true);
    setError(null);
    const result = await setTopicRespondents(assignTopicId, assignRespondentIds);
    setAssignSaving(false);
    if (result.ok) {
      closeAssignModal();
      refresh();
    } else setError(result.error);
  };

  return (
    <div className="space-y-8" dir="rtl">
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-start text-sm text-red-700">{error}</p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>סוגי הגהה</CardTitle>
          <Button size="sm" onClick={() => setAddTypeOpen(true)}>
            הוסף סוג הגהה
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {proofreaderTypes.map((pt) => (
              <li
                key={pt.id}
                className="flex items-center justify-between rounded-xl border border-card-border bg-card px-3 py-2"
              >
                <span className="font-medium text-primary">{pt.name_he}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditTypeId(pt.id);
                      setEditTypeName(pt.name_he);
                    }}
                  >
                    עריכה
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                    onClick={() => {
                      setDeleteConfirm("type");
                      setDeleteConfirmId(pt.id);
                    }}
                    disabled={pending}
                  >
                    מחיקה
                  </Button>
                </div>
              </li>
            ))}
            {proofreaderTypes.length === 0 && (
              <li className="text-start text-sm text-slate-500">אין סוגי הגהה. הוסף סוג כדי להתחיל.</li>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>נושאים ותת-נושאים</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setNewTopicTypeId(proofreaderTypes[0]?.id ?? "");
              setAddTopicOpen(true);
            }}
          >
            הוסף נושא
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {topics.map((topic) => (
            <div
              key={topic.id}
              className="rounded-xl border border-card-border bg-slate-50/50 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium text-primary">{topic.name_he}</span>
                  {topic.proofreader_type_name_he && (
                    <span className="text-sm text-slate-500">
                      ({topic.proofreader_type_name_he})
                    </span>
                  )}
                </div>
                <div className="grid w-full grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openAssignModal(topic)}
                  >
                    שיוך משיבים
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setAddSubTopicTopicId(topic.id);
                      setNewSubTopicName("");
                    }}
                  >
                    הוסף תת-נושא
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-600"
                    onClick={() => {
                      setDeleteConfirm("topic");
                      setDeleteConfirmId(topic.id);
                    }}
                    disabled={pending}
                  >
                    מחיקת נושא
                  </Button>
                </div>
              </div>
              <ul className="mt-3 space-y-1 pr-4">
                {topic.sub_topics.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-700">{s.name_he}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-red-600"
                      onClick={() => {
                        setDeleteConfirm("subtopic");
                        setDeleteConfirmId(s.id);
                      }}
                      disabled={pending}
                    >
                      מחק
                    </Button>
                  </li>
                ))}
                {topic.sub_topics.length === 0 && (
                  <li className="text-slate-500">אין תת-נושאים</li>
                )}
              </ul>
            </div>
          ))}
          {topics.length === 0 && (
            <p className="text-sm text-slate-500">אין נושאים. הוסף נושא כדי להתחיל.</p>
          )}
        </CardContent>
      </Card>

      {/* Add proofreader type dialog */}
      <Dialog open={addTypeOpen} onOpenChange={setAddTypeOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוסף סוג הגהה</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>שם (עברית)</Label>
            <Input
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="למשל: תוכן"
            />
            <Label>מזהה (slug, אופציונלי)</Label>
            <Input
              value={newTypeSlug}
              onChange={(e) => setNewTypeSlug(e.target.value)}
              placeholder="content"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTypeOpen(false)}>
              ביטול
            </Button>
            <Button variant="default" className="bg-primary" onClick={handleCreateType} disabled={pending || !newTypeName.trim()}>
              {pending ? "שומר…" : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit proofreader type dialog */}
      <Dialog open={!!editTypeId} onOpenChange={(open) => !open && setEditTypeId(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת סוג הגהה</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>שם (עברית)</Label>
            <Input
              value={editTypeName}
              onChange={(e) => setEditTypeName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTypeId(null)}>
              ביטול
            </Button>
            <Button variant="default" className="bg-primary" onClick={handleUpdateType} disabled={pending}>
              {pending ? "שומר…" : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add topic dialog */}
      <Dialog open={addTopicOpen} onOpenChange={setAddTopicOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוסף נושא</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>שם הנושא</Label>
            <Input
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="למשל: הלכה"
            />
            <Label>סוג הגהה</Label>
            <Select
              value={newTopicTypeId}
              onValueChange={setNewTopicTypeId}
            >
              <SelectTrigger className="w-full text-right">
                <SelectValue placeholder="בחר/י סוג" />
              </SelectTrigger>
              <SelectContent>
                {proofreaderTypes.map((pt) => (
                  <SelectItem key={pt.id} value={pt.id}>{pt.name_he}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTopicOpen(false)}>
              ביטול
            </Button>
            <Button
              variant="default"
              className="bg-primary"
              onClick={handleCreateTopic}
              disabled={pending || !newTopicName.trim() || !newTopicTypeId}
            >
              {pending ? "שומר…" : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add sub-topic dialog */}
      <Dialog
        open={!!addSubTopicTopicId}
        onOpenChange={(open) => !open && setAddSubTopicTopicId(null)}
      >
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוסף תת-נושא</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>שם תת-הנושא</Label>
            <Input
              value={newSubTopicName}
              onChange={(e) => setNewSubTopicName(e.target.value)}
              placeholder="למשל: שבת"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSubTopicTopicId(null)}>
              ביטול
            </Button>
            <Button
              variant="default"
              className="bg-primary"
              onClick={handleCreateSubTopic}
              disabled={pending || !newSubTopicName.trim()}
            >
              {pending ? "שומר…" : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* חלון אישור מחיקה (סגנון מערכת, ממורכז) */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && (setDeleteConfirm(null), setDeleteConfirmId(null))}>
        <DialogContent className="max-w-sm rounded-2xl border border-card-border bg-card px-5 py-4 text-center shadow-soft" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-center">
              {deleteConfirm === "type" && "מחיקת סוג הגהה"}
              {deleteConfirm === "topic" && "מחיקת נושא"}
              {deleteConfirm === "subtopic" && "מחיקת תת-נושא"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 text-center">
            {deleteConfirm === "type" && "למחוק את סוג ההגהה? נושאים המשויכים אליו יישארו ללא שיוך."}
            {deleteConfirm === "topic" && "למחוק את הנושא ואת כל תת-הנושאים?"}
            {deleteConfirm === "subtopic" && "למחוק את תת-הנושא?"}
          </p>
          <DialogFooter className="mt-4 flex w-full justify-center gap-2 sm:!justify-center">
            <Button variant="outline" onClick={() => { setDeleteConfirm(null); setDeleteConfirmId(null); }}>
              ביטול
            </Button>
            <Button variant="default" className="bg-red-600 text-white hover:bg-red-700" onClick={runDeleteConfirm} disabled={pending}>
              {pending ? "מוחק…" : "מחיקה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* חלון שיוך משיבים לנושא (אחרי הוספת נושא או מכפתור "שיוך משיבים") */}
      <Dialog open={assignOpen} onOpenChange={(open) => !open && closeAssignModal()}>
        <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-0 overflow-hidden p-0 px-0 pt-10 pb-0" dir="rtl">
          <DialogHeader className="px-4 sm:px-6">
            <DialogTitle>{assignTopicName || "שיוך משיבים"}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 w-full flex-1 overflow-y-auto">
          <div className="space-y-4 px-4 pb-1 sm:px-6">
            {assignSubTopics.length > 0 && (
              <div className="space-y-2">
                <Label className="text-right">תת-נושאים</Label>
                <ul className="list-none rounded-xl border border-card-border bg-slate-50 p-3 space-y-1 text-sm text-slate-700">
                  {assignSubTopics.map((s) => (
                    <li key={s.id}>{s.name_he}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-right">
                {userGender === "F" ? "בחרי אילו משיבים משויכים לנושא זה" : "בחר אילו משיבים משויכים לנושא זה"}
              </Label>
              {assignLoading ? (
                <div className="flex min-h-[6rem] items-center justify-center py-4" role="status" aria-live="polite">
                  <span className="sr-only">טוען…</span>
                  <PageLoadingSpinner />
                </div>
              ) : (
                <ul className="flex flex-col gap-1 rounded-xl border border-card-border bg-slate-50 p-3 list-none max-h-48 overflow-y-auto">
                  {assignRespondentsList.map((r) => (
                    <li key={r.id}>
                      <label className="flex cursor-pointer items-center gap-2 justify-start">
                        <Checkbox
                          checked={assignRespondentIds.includes(r.id)}
                          onCheckedChange={(v) =>
                            setAssignRespondentIds((prev) =>
                              v ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                            )
                          }
                        />
                        <span className="text-sm text-slate-600">{r.full_name_he || "—"}</span>
                      </label>
                    </li>
                  ))}
                  {assignRespondentsList.length === 0 && !assignLoading && (
                    <li className="text-sm text-secondary text-right">אין משיבים במערכת.</li>
                  )}
                </ul>
              )}
            </div>
          </div>
          </div>
          <DialogFooter className="px-4 pb-4 pt-2 sm:px-6">
            <Button variant="outline" onClick={closeAssignModal}>
              ביטול
            </Button>
            <Button
              variant="default"
              className="bg-primary"
              onClick={handleSaveAssignRespondents}
              disabled={assignSaving}
            >
              {assignSaving ? "שומר…" : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
