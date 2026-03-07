"use client";

import { permanentlyDeleteQuestion, restoreQuestion } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { QuestionRow } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function truncateSummary(text: string, maxLen = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

interface TrashTableProps {
  questions: QuestionRow[];
}

export function TrashTable({ questions }: TrashTableProps) {
  const router = useRouter();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    const result = await restoreQuestion(id);
    setRestoringId(null);
    if (result.ok) router.refresh();
    else alert(result.error);
  };

  const handlePermanentDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    const result = await permanentlyDeleteQuestion(id);
    setDeletingId(null);
    if (result.ok) router.refresh();
    else alert(result.error);
  };

  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>ID שאלה</TableHead>
              <TableHead>נושא / תקציר</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>תאריך השלכה</TableHead>
              <TableHead className="w-[220px]">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-secondary">
                  אין שאלות באשפה
                </TableCell>
              </TableRow>
            ) : (
              questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-xs text-secondary">
                    {q.short_id ?? `${q.id.slice(0, 8)}…`}
                  </TableCell>
                  <TableCell className="max-w-[320px]">
                    {q.title && <p className="text-sm font-medium text-slate-800">{q.title}</p>}
                    <span className={cn("line-clamp-2 text-sm", q.title && "text-slate-600")} title={q.content}>
                      {truncateSummary(q.content)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-md border font-medium bg-slate-100 text-slate-700">
                      {STAGE_LABELS[q.stage]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-secondary">
                    {q.deleted_at ? formatDate(q.deleted_at) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-primary"
                      onClick={() => handleRestore(q.id)}
                      disabled={restoringId === q.id || deletingId === q.id}
                    >
                      {restoringId === q.id ? "משחזר…" : "שחזר לפעיל"}
                    </Button>
                    {confirmDeleteId === q.id ? (
                      <span className="inline-flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handlePermanentDelete(q.id)}
                          disabled={deletingId === q.id}
                        >
                          {deletingId === q.id ? "מוחק…" : "מחק לצמיתות"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                          ביטול
                        </Button>
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setConfirmDeleteId(q.id)}
                        disabled={restoringId !== null || deletingId !== null}
                      >
                        מחק לצמיתות
                      </Button>
                    )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}
