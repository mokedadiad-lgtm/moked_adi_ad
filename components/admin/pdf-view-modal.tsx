"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";

interface PdfViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string | null;
  /** for=asker | for=archive – משפיע על שם הקובץ ב-URL (לצפייה משתמשים ב-view=1) */
  forParam?: "asker" | "archive";
}

/**
 * חלון צפייה ב-PDF פנימי (iframe) – בשימוש בארכיון, בפרטי שאלה, ובחלון שלב מוכן לשליחה.
 */
export function PdfViewModal({
  open,
  onOpenChange,
  questionId,
  forParam = "archive",
}: PdfViewModalProps) {
  const [cacheBust, setCacheBust] = useState<number>(() => Date.now());

  useEffect(() => {
    if (open && questionId) {
      setCacheBust(Date.now());
    }
  }, [open, questionId]);

  const src =
    questionId &&
    `/api/questions/${questionId}/pdf/download?for=${forParam}&view=1&cb=${cacheBust}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0"
        dir="rtl"
      >
        <DialogHeader className="px-4 pt-4 pb-0 shrink-0">
          <DialogTitle>צפייה ב-PDF</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 px-4 pb-4">
          {src && (
            <iframe
              title="תצוגת PDF"
              src={src}
              className="w-full h-full min-h-[70vh] rounded-lg border border-slate-200"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
