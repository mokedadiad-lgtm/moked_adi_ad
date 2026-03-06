"use client";

import {
  createProofreaderType,
  createSubTopic,
  createTopic,
  deleteProofreaderType,
  deleteSubTopic,
  deleteTopic,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

  const refresh = () => router.refresh();

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
    if (!confirm("למחוק את סוג ההגהה? נושאים המשויכים אליו יישארו ללא שיוך.")) return;
    setPending(true);
    const result = await deleteProofreaderType(id);
    setPending(false);
    if (result.ok) refresh();
    else setError(result.error);
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
      setAddTopicOpen(false);
      setNewTopicName("");
      setNewTopicTypeId(proofreaderTypes[0]?.id ?? "");
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
    if (!confirm("למחוק את הנושא ואת כל תת-הנושאים?")) return;
    setPending(true);
    const result = await deleteTopic(id);
    setPending(false);
    if (result.ok) refresh();
    else setError(result.error);
  };

  const handleDeleteSubTopic = async (id: string) => {
    if (!confirm("למחוק את תת-הנושא?")) return;
    setPending(true);
    const result = await deleteSubTopic(id);
    setPending(false);
    if (result.ok) refresh();
    else setError(result.error);
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
                    onClick={() => handleDeleteType(pt.id)}
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
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-primary">{topic.name_he}</span>
                  {topic.proofreader_type_name_he && (
                    <span className="me-2 text-sm text-slate-500">
                      ({topic.proofreader_type_name_he})
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
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
                    className="text-red-600"
                    onClick={() => handleDeleteTopic(topic.id)}
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
                      onClick={() => handleDeleteSubTopic(s.id)}
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
    </div>
  );
}
