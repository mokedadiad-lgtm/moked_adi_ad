"use client";

import {
  updateDualProofreadersConfig,
  type DualProofreadersAdminConfig,
  type TeamProfileRow,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

interface DualProofreadersSettingsProps {
  initial: DualProofreadersAdminConfig;
  proofreaders: TeamProfileRow[];
}

export function DualProofreadersSettings({
  initial,
  proofreaders,
}: DualProofreadersSettingsProps) {
  const router = useRouter();
  const [aId, setAId] = useState(initial.proofreader_a_id ?? "");
  const [bId, setBId] = useState(initial.proofreader_b_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const options = useMemo(
    () =>
      proofreaders
        .filter((p) => p.is_proofreader)
        .map((p) => ({
          id: p.id,
          label: p.full_name_he?.trim() || p.email || p.id.slice(0, 8),
        })),
    [proofreaders]
  );

  const onSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateDualProofreadersConfig({
        proofreader_a_id: aId || null,
        proofreader_b_id: bId || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <Card className="rounded-2xl border-violet-200/70 bg-violet-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-violet-900">שתי מגיהות קבועות (שער הגהה כפול)</CardTitle>
        <p className="text-sm text-slate-600">
          כל תשובה בלובי חייבת לעבור את שתי המגיהות האלה לפני מעבר לעריכה לשונית.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>מגיהה א׳</Label>
            <Select value={aId || "__none__"} onValueChange={(v) => setAId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="bg-white text-start">
                <SelectValue placeholder="בחרי מגיהה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— ללא —</SelectItem>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id} disabled={o.id === bId}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>מגיהה ב׳</Label>
            <Select value={bId || "__none__"} onValueChange={(v) => setBId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="bg-white text-start">
                <SelectValue placeholder="בחרי מגיהה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— ללא —</SelectItem>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id} disabled={o.id === aId}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            נשמר.
          </p>
        )}
        <div className="flex justify-start">
          <Button type="button" onClick={onSave} disabled={pending}>
            {pending ? "שומר…" : "שמירת מגיהות קבועות"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
