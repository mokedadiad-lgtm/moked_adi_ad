"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { QuestionRow, QuestionStage } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function truncateContent(text: string, maxLines = 3): string {
  const lines = text.split(/\n/).filter(Boolean);
  const show = lines.slice(0, maxLines).join("\n");
  return lines.length > maxLines ? `${show}...` : show;
}

function responseTypeLabel(t: "short" | "detailed" | null): string {
  if (t === "short") return "קצר";
  if (t === "detailed") return "מפורט";
  return "—";
}

interface AdminKanbanProps {
  byStage: Record<QuestionStage, QuestionRow[]>;
  stageOrder: QuestionStage[];
  stageLabels: Record<QuestionStage, string>;
}

export function AdminKanban({
  byStage,
  stageOrder,
  stageLabels,
}: AdminKanbanProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stageOrder.map((stage) => {
        const items = byStage[stage] ?? [];
        return (
          <div
            key={stage}
            className={cn(
              "flex min-w-[280px] max-w-[280px] flex-shrink-0 flex-col rounded-2xl border border-card-border bg-card shadow-soft"
            )}
          >
            <div className="border-b border-card-border p-3 text-start">
              <h2 className="text-sm font-semibold text-primary">
                {stageLabels[stage]}
              </h2>
              <p className="mt-0.5 text-xs text-secondary">
                {items.length} שאלות
              </p>
            </div>
            <ScrollArea className="flex-1 px-2" style={{ height: "calc(100vh - 220px)" }}>
              <div className="space-y-3 py-3">
                {items.length === 0 && (
                  <p className="py-6 text-start text-sm text-secondary">
                    אין שאלות
                  </p>
                )}
                {items.map((q) => (
                  <Card key={q.id} className="overflow-hidden">
                    <CardContent className="p-3">
                      {q.title && <p className="text-sm font-medium text-slate-800">{q.title}</p>}
                      <p
                        className={cn("line-clamp-3 text-start text-sm text-secondary", q.title && "mt-0.5")}
                        title={q.content}
                      >
                        {truncateContent(q.content)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {q.asker_age && (
                          <Badge variant="secondary">גיל {q.asker_age}</Badge>
                        )}
                        <Badge variant="outline">
                          {responseTypeLabel(q.response_type)}
                        </Badge>
                        <Badge variant="outline">
                          {formatDate(q.created_at)}
                        </Badge>
                      </div>
                    </CardContent>
                    <CardFooter className="border-t border-slate-100 p-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-sm"
                        type="button"
                      >
                        ניהול משימה
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
