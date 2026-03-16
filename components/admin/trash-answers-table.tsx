"use client";

import { permanentlyDeleteQuestionAnswer, restoreQuestionAnswer } from "@/app/admin/actions";
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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STAGE_LABELS, type QuestionStage } from "@/lib/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface TrashAnswerRow {
  id: string;
  question_id: string;
  deleted_at: string | null;
  stage: string;
  respondent_name: string | null;
  topic_name_he: string | null;
  sub_topic_name_he: string | null;
  short_id: string | null;
  title: string | null;
}

interface TrashAnswersTableProps {
  answers: TrashAnswerRow[];
}

export function TrashAnswersTable({ answers }: TrashAnswersTableProps) {
  const router = useRouter();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (answers.length === 0) return null;

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    const result = await restoreQuestionAnswer(id);
    setRestoringId(null);
    if (result.ok) router.refresh();
    else alert(result.error);
  };

  const handlePermanentDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    const result = await permanentlyDeleteQuestionAnswer(id);
    setDeletingId(null);
    if (result.ok) router.refresh();
    else alert(result.error);
  };

  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardContent className="p-0">
        <div className="border-b px-4 py-2 text-right text-sm font-semibold text-slate-700">
          תשובות שנמחקו (ללא מחיקת כל השאלה)
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>ID שאלה</TableHead>
                <TableHead>משיב/ה</TableHead>
                <TableHead>חלק השאלה</TableHead>
                <TableHead>סטטוס תשובה</TableHead>
                <TableHead>תאריך השלכה</TableHead>
                <TableHead className="w-[220px]">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {answers.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs text-secondary">
                    {a.short_id ?? `${a.question_id.slice(0, 8)}…`}
                  </TableCell>
                  <TableCell className="text-sm text-slate-800">
                    {a.respondent_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {[a.topic_name_he, a.sub_topic_name_he].filter(Boolean).join(" · ") || "ללא נושא"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-md border font-medium bg-slate-100 text-slate-700">
                      {STAGE_LABELS[a.stage as QuestionStage] ?? a.stage}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-secondary">
                    {formatDate(a.deleted_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-primary"
                        onClick={() => handleRestore(a.id)}
                        disabled={restoringId === a.id || deletingId === a.id}
                      >
                        {restoringId === a.id ? "משחזר…" : "שחזר תשובה"}
                      </Button>
                      {confirmDeleteId === a.id ? (
                        <span className="inline-flex items-center gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handlePermanentDelete(a.id)}
                            disabled={deletingId === a.id}
                          >
                            {deletingId === a.id ? "מוחק…" : "מחק לצמיתות"}
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
                          onClick={() => setConfirmDeleteId(a.id)}
                          disabled={restoringId !== null || deletingId !== null}
                        >
                          מחק לצמיתות
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

