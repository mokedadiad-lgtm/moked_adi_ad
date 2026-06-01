"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { syncAppSessionCookie } from "@/lib/sync-app-session";
import { useEffect, useRef, useState } from "react";

interface PdfViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string | null;
  /** for=asker | for=archive – משפיע על שם הקובץ ב-URL (לצפייה משתמשים ב-view=1) */
  forParam?: "asker" | "archive";
}

/**
 * חלון צפייה ב-PDF פנימי (blob + iframe) – מונע ניווט בדפדפן שגורם להתנתקות אחרי סגירה.
 */
export function PdfViewModal({
  open,
  onOpenChange,
  questionId,
  forParam = "archive",
}: PdfViewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !questionId) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setBlobUrl(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      await syncAppSessionCookie();
      const url = `/api/questions/${questionId}/pdf/download?for=${forParam}&view=1&cb=${Date.now()}`;
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          throw new Error(res.status === 404 ? "קובץ PDF לא נמצא" : "לא ניתן לטעון את ה-PDF");
        }
        const blob = await res.blob();
        if (cancelled) return;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setBlobUrl(objectUrl);
        setLoadError(null);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "שגיאה בטעינת PDF");
          setBlobUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [open, questionId, forParam]);

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
          {loading && (
            <p className="flex h-full min-h-[70vh] items-center justify-center text-sm text-slate-500">
              טוען PDF…
            </p>
          )}
          {loadError && !loading && (
            <p className="flex h-full min-h-[70vh] items-center justify-center text-sm text-red-600" role="alert">
              {loadError}
            </p>
          )}
          {blobUrl && !loading && (
            <iframe
              title="תצוגת PDF"
              src={blobUrl}
              className="w-full h-full min-h-[70vh] rounded-lg border border-slate-200"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
