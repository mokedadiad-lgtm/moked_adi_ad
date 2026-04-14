"use client";

import type { TeamJoinSubmissionRow, TeamJoinTokenRow } from "@/app/admin/team-join-actions";
import {
  approveTeamJoinSubmission,
  deactivateTeamJoinToken,
  generateTeamJoinLink,
  rejectTeamJoinSubmission,
} from "@/app/admin/team-join-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const KIND_LABEL: Record<string, string> = {
  respondent: "משיב/ה",
  proofreader: "מגיה/ה",
};

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

export function TeamJoinAdminSection({
  initialPending,
  initialTokens,
}: {
  initialPending: TeamJoinSubmissionRow[];
  initialTokens: TeamJoinTokenRow[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(initialPending);
  const [tokens, setTokens] = useState(initialTokens);

  useEffect(() => {
    setPending(initialPending);
  }, [initialPending]);

  useEffect(() => {
    setTokens(initialTokens);
  }, [initialTokens]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokeBusyId, setRevokeBusyId] = useState<string | null>(null);
  const [genUrl, setGenUrl] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [actorProfileId, setActorProfileId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!cancelled) setActorProfileId(user?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  const refresh = () => {
    router.refresh();
  };

  const onGenerate = async (kind: "respondent" | "proofreader") => {
    setError(null);
    const r = await generateTeamJoinLink(kind, actorProfileId);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setGenUrl(r.url);
    copyText(r.url);
    refresh();
  };

  const onDeactivateToken = async (id: string) => {
    setRevokeBusyId(id);
    setError(null);
    const r = await deactivateTeamJoinToken(id);
    setRevokeBusyId(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, is_active: false } : t)));
    refresh();
  };

  const onApprove = async (id: string) => {
    setBusyId(id);
    setError(null);
    const r = await approveTeamJoinSubmission(id, actorProfileId);
    setBusyId(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== id));
    refresh();
  };

  const onReject = async (id: string) => {
    setBusyId(id);
    setError(null);
    const r = await rejectTeamJoinSubmission(id, rejectNote[id], actorProfileId);
    setBusyId(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== id));
    refresh();
  };

  const baseUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join-team` : "/join-team";

  return (
    <div className="space-y-4" id="team-join-forms">
      <Card className="rounded-2xl border-slate-200 ring-1 ring-slate-200/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">טפסי הצטרפות עצמית</CardTitle>
          <p className="text-sm text-slate-600">
            הפיקו קישור והעתיקו למועמדים. הקישור כולל טוקן חד-פעמי. לאחר מילוי הטופס הבקשה תופיע למטה לאישור.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void onGenerate("respondent")}>
              הפק קישור — משיב/ה
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void onGenerate("proofreader")}>
              הפק קישור — מגיה/ה
            </Button>
          </div>
          {genUrl && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-sm">
              <p className="font-medium text-emerald-900">הקישור הועתק ללוח (הדביקו איפה שצריך):</p>
              <p className="mt-1 break-all font-mono text-xs text-emerald-800" dir="ltr">
                {genUrl}
              </p>
              <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => copyText(genUrl)}>
                העתק שוב
              </Button>
            </div>
          )}
          <p className="text-xs text-slate-500">
            תבנית קישור ידנית (אחרי הפקה):{" "}
            <code className="rounded bg-slate-100 px-1" dir="ltr">
              {baseUrl}/respondent?t=…
            </code>{" "}
            או{" "}
            <code className="rounded bg-slate-100 px-1" dir="ltr">
              /proofreader?t=…
            </code>
          </p>

          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-medium text-slate-700">קישורים שהופקו לאחרונה (50 אחרונים)</p>
            <p className="mb-3 text-xs text-slate-500">
              הטוקן נשמר בשרת רק כהאש — לא ניתן להציג שוב את כתובת ה-URL המלאה. שמרו את הקישור בעת ההפקה או הפיקו
              חדש. ניתן לנטרל קישור ישן כדי שלא יעבוד עוד.
            </p>
            {tokens.length === 0 ? (
              <p className="text-sm text-slate-600">עדיין לא הופקו קישורים.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>סוג</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>תוקף</TableHead>
                      <TableHead>נוצר</TableHead>
                      <TableHead className="w-[120px]">פעולה</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokens.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{KIND_LABEL[t.form_kind] ?? t.form_kind}</TableCell>
                        <TableCell className="text-sm">
                          {t.is_active ? (
                            <span className="text-emerald-700">פעיל</span>
                          ) : (
                            <span className="text-slate-500">מנוטרל</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-600">
                          {t.expires_at
                            ? new Date(t.expires_at).toLocaleString("he-IL")
                            : "ללא הגבלה"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-600">
                          {new Date(t.created_at).toLocaleString("he-IL")}
                        </TableCell>
                        <TableCell>
                          {t.is_active ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={revokeBusyId === t.id}
                              onClick={() => void onDeactivateToken(t.id)}
                            >
                              {revokeBusyId === t.id ? "…" : "נטרל"}
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-900">{error}</div>}

      <Card className="rounded-2xl border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">בקשות הצטרפות ממתינות</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {pending.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-600">אין בקשות ממתינות</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>אימייל</TableHead>
                    <TableHead>שם</TableHead>
                    <TableHead>סוג</TableHead>
                    <TableHead>תאריך</TableHead>
                    <TableHead className="min-w-[200px]">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((row) => {
                    const pl = row.payload as { email?: string; full_name_he?: string | null };
                    const email = pl.email ?? "—";
                    const name = pl.full_name_he ?? "—";
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs" dir="ltr">
                          {email}
                        </TableCell>
                        <TableCell>{name}</TableCell>
                        <TableCell>{KIND_LABEL[row.form_kind] ?? row.form_kind}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-600">
                          {new Date(row.created_at).toLocaleString("he-IL")}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Button
                              type="button"
                              size="sm"
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                              disabled={busyId === row.id}
                              onClick={() => void onApprove(row.id)}
                            >
                              {busyId === row.id ? "…" : "אשר וצור משתמש"}
                            </Button>
                            <div className="flex flex-1 flex-col gap-1">
                              <Input
                                placeholder="סיבת דחייה (אופציונלי)"
                                value={rejectNote[row.id] ?? ""}
                                onChange={(e) =>
                                  setRejectNote((prev) => ({ ...prev, [row.id]: e.target.value }))
                                }
                                className="text-sm"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busyId === row.id}
                                onClick={() => void onReject(row.id)}
                              >
                                דחה
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
