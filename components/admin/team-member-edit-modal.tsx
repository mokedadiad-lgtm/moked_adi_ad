"use client";

import type { CategoryOption, ProofreaderTypeOption, TeamProfileRow } from "@/app/admin/actions";
import { deleteTeamMember, updateTeamMember } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";

const COMM_LABELS: Record<string, string> = {
  email: "דוא\"ל בלבד",
  whatsapp: "וואטסאפ בלבד",
  both: "גם וגם",
};

interface TeamMemberEditModalProps {
  profile: TeamProfileRow | null;
  categories: CategoryOption[];
  proofreaderTypes: ProofreaderTypeOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TeamMemberEditModal({
  profile,
  categories,
  proofreaderTypes,
  open,
  onOpenChange,
  onSuccess,
}: TeamMemberEditModalProps) {
  const [full_name_he, setFullNameHe] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [is_respondent, setIsRespondent] = useState(false);
  const [is_proofreader, setIsProofreader] = useState(false);
  const [is_linguistic_editor, setIsLinguisticEditor] = useState(false);
  const [proofreader_type_id, setProofreaderTypeId] = useState<string>("");
  const [communication_preference, setCommunicationPreference] = useState<"whatsapp" | "email" | "both">("email");
  const [phone, setPhone] = useState("");
  const [concurrency_limit, setConcurrencyLimit] = useState(1);
  const [cooldown_days, setCooldownDays] = useState(0);
  const [admin_note, setAdminNote] = useState("");
  const [category_ids, setCategoryIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullNameHe(profile.full_name_he ?? "");
      setGender(profile.gender);
      setIsRespondent(profile.is_respondent);
      setIsProofreader(profile.is_proofreader);
      setIsLinguisticEditor(profile.is_linguistic_editor);
      setProofreaderTypeId(profile.proofreader_type_id ?? proofreaderTypes[0]?.id ?? "");
      setCommunicationPreference(profile.communication_preference ?? "email");
      setPhone(profile.phone ?? "");
      setConcurrencyLimit(profile.concurrency_limit ?? 1);
      setCooldownDays(profile.cooldown_days ?? 0);
      setAdminNote(profile.admin_note ?? "");
      setCategoryIds(profile.category_ids ?? []);
      setError(null);
      setDeleteConfirm(false);
    }
  }, [profile, proofreaderTypes]);

  const handleSubmit = async () => {
    if (!profile) return;
    setPending(true);
    setError(null);
    const result = await updateTeamMember(profile.id, {
      full_name_he: full_name_he.trim() || null,
      gender,
      is_respondent,
      is_proofreader,
      is_linguistic_editor,
      proofreader_type_id: is_proofreader ? (proofreader_type_id || null) : null,
      communication_preference,
      phone: phone.trim() || null,
      concurrency_limit,
      cooldown_days,
      admin_note: admin_note.trim() || null,
      category_ids,
    });
    setPending(false);
    if (result.ok) {
      onSuccess();
      onOpenChange(false);
    } else {
      setError(result.error);
    }
  };

  const handleDelete = async () => {
    if (!profile || !deleteConfirm) return;
    setDeleting(true);
    setError(null);
    const result = await deleteTeamMember(profile.id);
    setDeleting(false);
    if (result.ok) {
      onSuccess();
      onOpenChange(false);
    } else {
      setError(result.error);
    }
  };

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-4 overflow-hidden" dir="rtl">
        <DialogHeader className="shrink-0">
          <DialogTitle>עריכת איש צוות</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-4 text-right" dir="rtl">
          <div className="space-y-2">
            <Label htmlFor="team-full_name_he">שם מלא</Label>
            <Input
              id="team-full_name_he"
              value={full_name_he}
              onChange={(e) => setFullNameHe(e.target.value)}
              placeholder="שם מלא בעברית"
              className="text-right"
            />
          </div>

          <div className="space-y-2">
            <Label>מגדר</Label>
            <Select value={gender} onValueChange={(v) => setGender(v as "M" | "F")}>
              <SelectTrigger className="w-full text-right">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">נקבה</SelectItem>
                <SelectItem value="M">זכר</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-right">תפקידים</Label>
            <div className="flex flex-col gap-2 rounded-xl border border-card-border bg-slate-50 p-3">
              <label className="flex cursor-pointer items-center gap-3 justify-start">
                <Checkbox checked={is_respondent} onCheckedChange={(v) => setIsRespondent(!!v)} />
                <span className="text-sm text-slate-600">משיב/ה</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 justify-start">
                <Checkbox checked={is_proofreader} onCheckedChange={(v) => setIsProofreader(!!v)} />
                <span className="text-sm text-slate-600">מגיה/ה</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 justify-start">
                <Checkbox checked={is_linguistic_editor} onCheckedChange={(v) => setIsLinguisticEditor(!!v)} />
                <span className="text-sm text-slate-600">עורך/ת לשוני/ת</span>
              </label>
            </div>
          </div>

          {is_proofreader && (
            <div className="space-y-2">
              <Label className="text-right">סוג מגיה/ה</Label>
              <Select
                value={proofreader_type_id}
                onValueChange={setProofreaderTypeId}
              >
                <SelectTrigger className="w-full text-right">
                  <SelectValue placeholder="בחר/י סוג" />
                </SelectTrigger>
                <SelectContent>
                  {proofreaderTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>{pt.name_he}</SelectItem>
                  ))}
                  {proofreaderTypes.length === 0 && (
                    <SelectItem value="_none" disabled>אין סוגים מוגדרים</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {(is_respondent || is_proofreader) && (
            <>
              <div className="space-y-2">
                <Label className="text-right">העדפת תקשורת</Label>
                <Select
                  value={communication_preference}
                  onValueChange={(v) => setCommunicationPreference(v as "whatsapp" | "email" | "both")}
                >
                  <SelectTrigger className="w-full text-right">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">{COMM_LABELS.email}</SelectItem>
                    <SelectItem value="whatsapp">{COMM_LABELS.whatsapp}</SelectItem>
                    <SelectItem value="both">{COMM_LABELS.both}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">טלפון (וואטסאפ)</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05X-XXXXXXX"
                  className="text-right"
                />
              </div>

              {is_respondent && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="concurrency_limit">מכסה שאלות במקביל</Label>
                      <Input
                        id="concurrency_limit"
                        type="number"
                        min={0}
                        value={concurrency_limit}
                        onChange={(e) => setConcurrencyLimit(parseInt(e.target.value, 10) || 0)}
                        className="text-right"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cooldown_days">ימי צינון (בין שאלה לשאלה)</Label>
                      <Input
                        id="cooldown_days"
                        type="number"
                        min={0}
                        value={cooldown_days}
                        onChange={(e) => setCooldownDays(parseInt(e.target.value, 10) || 0)}
                        className="text-right"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin_note">הערת מנהל (לשיבוץ)</Label>
                    <Textarea
                      id="admin_note"
                      value={admin_note}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="הנחיה אישית למשיב/ה..."
                      rows={2}
                      className="text-right"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label className="text-right">קטגוריות שאלות (נושאי תשובה שהמשיב/ה יכול/ה לקבל)</Label>
                <div className="flex flex-wrap gap-2 justify-start rounded-xl border border-card-border bg-slate-50 p-3">
                  {categories.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 justify-start">
                      <Checkbox
                        checked={category_ids.includes(c.id)}
                        onCheckedChange={(v) =>
                          setCategoryIds((prev) =>
                            v ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                          )
                        }
                      />
                      <span className="text-sm text-slate-600">{c.name_he}</span>
                    </label>
                  ))}
                  {categories.length === 0 && (
                    <span className="block text-right text-sm text-secondary">אין קטגוריות במערכת. הרץ מיגרציות Supabase (כולל seed קטגוריות).</span>
                  )}
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 p-2 text-right text-sm text-red-700">{error}</p>
          )}
        </div>
        </div>

        <DialogFooter className="shrink-0 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2 justify-start text-sm text-slate-600">
              <Checkbox checked={deleteConfirm} onCheckedChange={(v) => setDeleteConfirm(!!v)} />
              <span>אני מבין/ה שמחיקה תסיר את המשתמש מהמערכת</span>
            </label>
            <Button
              type="button"
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={handleDelete}
              disabled={!deleteConfirm || deleting}
            >
              {deleting ? "מוחק…" : "מחק איש צוות"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={pending}>
              {pending ? "שומר…" : "שמור שינויים"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
