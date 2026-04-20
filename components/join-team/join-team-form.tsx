"use client";

import type { ProofreaderTypeOption, TopicOption } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ASKER_AGE_RANGE_LABELS, type AskerAgeRangeLabel } from "@/lib/asker-age-ranges";
import { useState } from "react";

const COMM: Record<string, string> = {
  email: 'דוא"ל בלבד',
  whatsapp: "וואטסאפ בלבד",
  both: "גם וגם",
};

type Kind = "respondent" | "proofreader";

export function JoinTeamForm({
  kind,
  initialToken,
  topics,
  proofreaderTypes,
}: {
  kind: Kind;
  initialToken: string;
  topics: TopicOption[];
  proofreaderTypes: ProofreaderTypeOption[];
}) {
  const [token, setToken] = useState(initialToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [full_name_he, setFullNameHe] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [communication_preference, setCommunicationPreference] = useState<"whatsapp" | "email" | "both">("email");
  const [phone, setPhone] = useState("");
  const [concurrency_limit, setConcurrencyLimit] = useState(1);
  const [cooldown_days, setCooldownDays] = useState(0);
  const [respondent_age_ranges, setRespondentAgeRanges] = useState<AskerAgeRangeLabel[]>([]);
  const [topic_ids, setTopicIds] = useState<string[]>([]);
  const [proofreader_type_ids, setProofreaderTypeIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!token.trim()) {
      setError("חסר פרמטר קישור (t). נא להשתמש בקישור המלא שנשלח אליכם.");
      return;
    }
    if (!email.trim()) {
      setError("נא להזין אימייל.");
      return;
    }
    if (password.length < 6) {
      setError("סיסמה: לפחות 6 תווים.");
      return;
    }
    if (password !== password2) {
      setError("הסיסמאות אינן זהות.");
      return;
    }
    if (kind === "proofreader" && proofreader_type_ids.length === 0) {
      setError("נא לבחור לפחות סוג הגהה אחד.");
      return;
    }
    if (kind === "respondent" && respondent_age_ranges.length === 0) {
      setError("נא לבחור לפחות טווח גיל אחד.");
      return;
    }
    if (kind === "respondent" && (concurrency_limit < 1 || concurrency_limit > 3)) {
      setError("מספר שאלות בשבוע חייב להיות בין 1 ל־3.");
      return;
    }

    const base = {
      token: token.trim(),
      form_kind: kind,
      password,
      email: email.trim(),
      full_name_he: full_name_he.trim() || null,
      gender,
      communication_preference,
      phone: phone.trim() || null,
      concurrency_limit,
      cooldown_days,
    };

    const body =
      kind === "respondent"
        ? { ...base, cooldown_days: 7, topic_ids, respondent_age_ranges }
        : { ...base, proofreader_type_ids };

    setPending(true);
    try {
      const res = await fetch("/api/team/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "שליחה נכשלה");
        return;
      }
      setDone(true);
    } catch {
      setError("שגיאת רשת");
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-900">
        <p className="font-semibold">הבקשה נשלחה בהצלחה</p>
        <p className="mt-2 text-emerald-800">הבקשה תיבדק על ידי מנהל המערכת. תקבלו עדכון לאחר האישור.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-card-border bg-card p-4 shadow-sm">
      {!initialToken.trim() && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <Label htmlFor="join-token">הדביקו כאן את הטוקן מהקישור (או השתמשו בקישור המלא מההודעה)</Label>
          <Input
            id="join-token"
            className="mt-1 font-mono text-sm"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="מהפרמטר t= בקישור"
            dir="ltr"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="jt-email">אימייל</Label>
        <Input id="jt-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="text-right" dir="ltr" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="jt-pw">סיסמה (לכניסה למערכת)</Label>
        <Input id="jt-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="text-right" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="jt-pw2">אימות סיסמה</Label>
        <Input id="jt-pw2" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} className="text-right" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="jt-name">שם מלא</Label>
        <Input id="jt-name" value={full_name_he} onChange={(e) => setFullNameHe(e.target.value)} className="text-right" />
      </div>
      <div className="space-y-2">
        <Label>מגדר</Label>
        <Select value={gender} onValueChange={(v) => setGender(v as "M" | "F")}>
          <SelectTrigger className="text-right">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="F">נקבה</SelectItem>
            <SelectItem value="M">זכר</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>העדפת תקשורת</Label>
        <Select
          value={communication_preference}
          onValueChange={(v) => setCommunicationPreference(v as "whatsapp" | "email" | "both")}
        >
          <SelectTrigger className="text-right">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">{COMM.email}</SelectItem>
            <SelectItem value="whatsapp">{COMM.whatsapp}</SelectItem>
            <SelectItem value="both">{COMM.both}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="jt-phone">טלפון (וואטסאפ)</Label>
        <Input id="jt-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="text-right" />
      </div>

      {kind === "respondent" ? (
        <div className="space-y-2">
          <Label htmlFor="jt-conc">כמה שאלות תוכל/י לקבל בשבוע?</Label>
          <Input
            id="jt-conc"
            type="number"
            min={1}
            max={3}
            value={concurrency_limit}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (Number.isNaN(n)) {
                setConcurrencyLimit(1);
                return;
              }
              setConcurrencyLimit(Math.min(3, Math.max(1, n)));
            }}
            className="text-right"
          />
        </div>
      ) : null}

      {kind === "respondent" && (
        <>
          <div className="space-y-2">
            <Label className="text-right">לאיזה גילאים תוכל/י לענות? (אפשר לבחור כמה)</Label>
            <ul className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
              {ASKER_AGE_RANGE_LABELS.map((range) => (
                <li key={range}>
                  <label className="flex cursor-pointer items-center gap-2">
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
                    <span className="text-sm">{range}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <Label className="text-right">נושאים שתוכלו לקבל</Label>
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
              {topics.map((t) => (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={topic_ids.includes(t.id)}
                      onCheckedChange={(v) =>
                        setTopicIds((prev) => (v ? [...prev, t.id] : prev.filter((id) => id !== t.id)))
                      }
                    />
                    <span className="text-sm">{t.name_he}</span>
                  </label>
                </li>
              ))}
              {topics.length === 0 && <li className="text-sm text-slate-500">אין נושאים במערכת</li>}
            </ul>
          </div>
        </>
      )}

      {kind === "proofreader" && (
        <>
          <div className="space-y-2">
            <Label className="text-right">סוגי הגהה</Label>
            <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              {proofreaderTypes.map((pt) => (
                <label key={pt.id} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={proofreader_type_ids.includes(pt.id)}
                    onCheckedChange={(checked) => {
                      if (checked) setProofreaderTypeIds((prev) => [...prev, pt.id]);
                      else setProofreaderTypeIds((prev) => prev.filter((id) => id !== pt.id));
                    }}
                  />
                  <span className="text-sm">{pt.name_he}</span>
                </label>
              ))}
              {proofreaderTypes.length === 0 && <span className="text-sm text-slate-500">אין סוגים</span>}
            </div>
          </div>
        </>
      )}

      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}

      <Button type="button" className="w-full bg-primary" onClick={() => void handleSubmit()} disabled={pending}>
        {pending ? "שולח…" : "שליחת בקשה"}
      </Button>
    </div>
  );
}
