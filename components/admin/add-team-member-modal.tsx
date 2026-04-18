"use client";

import type { ProofreaderTypeOption, TopicOption } from "@/app/admin/actions";
import { createTeamMember } from "@/app/admin/actions";
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
import { ASKER_AGE_RANGE_LABELS, type AskerAgeRangeLabel } from "@/lib/asker-age-ranges";
import { useState } from "react";

const COMM_LABELS: Record<string, string> = {
  email: "דוא\"ל בלבד",
  whatsapp: "וואטסאפ בלבד",
  both: "גם וגם",
};
interface AddTeamMemberModalProps {
  proofreaderTypes: ProofreaderTypeOption[];
  topics: TopicOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddTeamMemberModal({
  proofreaderTypes,
  topics,
  open,
  onOpenChange,
  onSuccess,
}: AddTeamMemberModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [full_name_he, setFullNameHe] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [is_respondent, setIsRespondent] = useState(false);
  const [is_proofreader, setIsProofreader] = useState(false);
  const [is_linguistic_editor, setIsLinguisticEditor] = useState(false);
  const [is_technical_lead, setIsTechnicalLead] = useState(false);
  const [proofreader_type_ids, setProofreaderTypeIds] = useState<string[]>([]);
  const [communication_preference, setCommunicationPreference] = useState<"whatsapp" | "email" | "both">("email");
  const [phone, setPhone] = useState("");
  const [concurrency_limit, setConcurrencyLimit] = useState(1);
  const [cooldown_days, setCooldownDays] = useState(0);
  const [topic_ids, setTopicIds] = useState<string[]>([]);
  const [respondent_age_ranges, setRespondentAgeRanges] = useState<AskerAgeRangeLabel[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setPassword("");
    setFullNameHe("");
    setGender("M");
    setIsRespondent(false);
    setIsProofreader(false);
    setIsLinguisticEditor(false);
    setIsTechnicalLead(false);
    setProofreaderTypeIds([]);
    setCommunicationPreference("email");
    setPhone("");
    setConcurrencyLimit(1);
    setCooldownDays(0);
    setTopicIds([]);
    setRespondentAgeRanges([]);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("נא להזין אימייל.");
      return;
    }
    if (!password || password.length < 6) {
      setError("נא להזין סיסמה (לפחות 6 תווים).");
      return;
    }
    if (is_proofreader && proofreader_type_ids.length === 0) {
      setError("מגיה/ה חייב/ת שיהיה לפחות סוג הגהה אחד.");
      return;
    }
    if (is_respondent && respondent_age_ranges.length === 0) {
      setError("למשיב/ה יש לבחור לפחות טווח גיל אחד.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await createTeamMember({
      email: email.trim(),
      password,
      full_name_he: full_name_he.trim() || null,
      gender,
      is_respondent,
      is_proofreader,
      is_linguistic_editor,
      is_technical_lead,
      proofreader_type_ids: is_proofreader ? proofreader_type_ids : [],
      communication_preference,
      phone: phone.trim() || null,
      concurrency_limit,
      cooldown_days,
      topic_ids: is_respondent ? topic_ids : [],
      respondent_age_ranges: is_respondent ? respondent_age_ranges : [],
    });
    setPending(false);
    if (result.ok) {
      onSuccess();
      handleOpenChange(false);
    } else {
      setError(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-2xl flex-col gap-0 overflow-hidden p-0 px-0 pt-10 pb-0" dir="rtl">
        <DialogHeader className="shrink-0 px-4 sm:px-6">
          <DialogTitle>הוסף איש צוות</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 w-full flex-1 overflow-y-auto">
        <div className="grid gap-4 px-4 pb-1 text-right sm:px-6" dir="rtl">
          <div className="space-y-2">
            <Label htmlFor="add-email">אימייל</Label>
            <Input
              id="add-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="text-right"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-password">סיסמה (זמנית – להעברה למשתמש)</Label>
            <Input
              id="add-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="לפחות 6 תווים"
              className="text-right"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-name">שם מלא</Label>
            <Input
              id="add-name"
              value={full_name_he}
              onChange={(e) => setFullNameHe(e.target.value)}
              placeholder="שם בעברית"
              className="text-right"
              disabled={pending}
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
              <label className="flex cursor-pointer items-center gap-3 justify-start">
                <Checkbox checked={is_technical_lead} onCheckedChange={(v) => setIsTechnicalLead(!!v)} />
                <span className="text-sm text-slate-600">אחראי טכני</span>
              </label>
            </div>
          </div>

          {is_proofreader && (
            <div className="space-y-2">
              <Label className="text-right">סוגי הגהה (אפשר לבחור כמה)</Label>
              <div className="flex flex-wrap gap-4 justify-end">
                {proofreaderTypes.map((pt) => (
                  <label key={pt.id} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={proofreader_type_ids.includes(pt.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setProofreaderTypeIds((prev) => [...prev, pt.id]);
                        else setProofreaderTypeIds((prev) => prev.filter((id) => id !== pt.id));
                      }}
                    />
                    <span className="text-sm text-slate-700">{pt.name_he}</span>
                  </label>
                ))}
                {proofreaderTypes.length === 0 && (
                  <span className="text-sm text-slate-500">אין סוגים מוגדרים</span>
                )}
              </div>
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
                <Label htmlFor="add-phone">טלפון (וואטסאפ)</Label>
                <Input
                  id="add-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05X-XXXXXXX"
                  className="text-right"
                  disabled={pending}
                />
              </div>

              {is_respondent && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-concurrency">מכסה שאלות במקביל</Label>
                      <Input
                        id="add-concurrency"
                        type="number"
                        min={0}
                        value={concurrency_limit}
                        onChange={(e) => setConcurrencyLimit(parseInt(e.target.value, 10) || 0)}
                        className="text-right"
                        disabled={pending}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-cooldown">ימי צינון (בין שאלה לשאלה)</Label>
                      <Input
                        id="add-cooldown"
                        type="number"
                        min={0}
                        value={cooldown_days}
                        onChange={(e) => setCooldownDays(parseInt(e.target.value, 10) || 0)}
                        className="text-right"
                        disabled={pending}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-right">לאיזה גילאים המשיב/ה יכול/ה לענות? (אפשר לבחור כמה)</Label>
                    <ul className="flex flex-col gap-1 rounded-xl border border-card-border bg-slate-50 p-3 list-none">
                      {ASKER_AGE_RANGE_LABELS.map((range) => (
                        <li key={range}>
                          <label className="flex cursor-pointer items-center gap-2 justify-start">
                            <Checkbox
                              checked={respondent_age_ranges.includes(range)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setRespondentAgeRanges((prev) =>
                                    prev.includes(range) ? prev : [...prev, range]
                                  );
                                } else {
                                  setRespondentAgeRanges((prev) => prev.filter((r) => r !== range));
                                }
                              }}
                            />
                            <span className="text-sm text-slate-600">{range}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {is_respondent && (
                <div className="space-y-2">
                  <Label className="text-right">נושאים משויכים (שהמשיב/ה יכול/ה לקבל)</Label>
                  <ul className="flex flex-col gap-1 rounded-xl border border-card-border bg-slate-50 p-3 list-none">
                    {topics.map((t) => (
                      <li key={t.id}>
                        <label className="flex cursor-pointer items-center gap-2 justify-start">
                          <Checkbox
                            checked={topic_ids.includes(t.id)}
                            onCheckedChange={(v) =>
                              setTopicIds((prev) =>
                                v ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                              )
                            }
                          />
                          <span className="text-sm text-slate-600">{t.name_he}</span>
                        </label>
                      </li>
                    ))}
                    {topics.length === 0 && (
                      <li className="text-sm text-secondary text-right">אין נושאים במערכת.</li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 p-2 text-right text-sm text-red-700">{error}</p>
          )}
        </div>
        </div>

        <DialogFooter className="shrink-0 px-4 pb-4 pt-2 sm:px-6">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            ביטול
          </Button>
          <Button type="button" variant="default" className="bg-primary" onClick={handleSubmit} disabled={pending}>
            {pending ? "יוצר…" : "הוסף איש צוות"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
