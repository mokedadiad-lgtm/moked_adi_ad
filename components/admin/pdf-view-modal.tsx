"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { syncAppSessionCookie } from "@/lib/sync-app-session";
import { useEffect, useRef, useState } from "react";

interface PdfViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string | null;
  /** for=asker | for=archive – משפיע על שם הקובץ ב-URL (לצפייה משתמשים ב-view=1) */
  forParam?: "asker" | "archive";
}

/** Android/iOS לא מציגים PDF בתוך iframe עם blob: — רק URL ישיר לשרת */
function prefersDirectPdfUrl(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function pdfApiUrl(questionId: string, forParam: "asker" | "archive", cacheBust: number) {
  return `/api/questions/${questionId}/pdf/download?for=${forParam}&view=1&cb=${cacheBust}`;
}

/**
 * חלון צפייה ב-PDF: בדסקטופ blob+iframe (מונע התנתקות), במובייל URL ישיר ל-API.
 */
export function PdfViewModal({
  open,
  onOpenChange,
  questionId,
  forParam = "archive",
}: PdfViewModalProps) {
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [directApiUrl, setDirectApiUrl] = useState<string | null>(null);
  const [useDirectUrl, setUseDirectUrl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setUseDirectUrl(prefersDirectPdfUrl());
  }, []);

  useEffect(() => {
    if (!open || !questionId) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setViewerSrc(null);
      setDirectApiUrl(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    const apiUrl = pdfApiUrl(questionId, forParam, Date.now());

    (async () => {
      await syncAppSessionCookie();
      if (cancelled) return;

      if (prefersDirectPdfUrl()) {
        setDirectApiUrl(apiUrl);
        setViewerSrc(apiUrl);
        setLoadError(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(apiUrl, { credentials: "include" });
        if (!res.ok) {
          throw new Error(res.status === 404 ? "קובץ PDF לא נמצא" : "לא ניתן לטעון את ה-PDF");
        }
        const blob = await res.blob();
        if (cancelled) return;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setDirectApiUrl(null);
        setViewerSrc(objectUrl);
        setLoadError(null);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "שגיאה בטעינת PDF");
          setViewerSrc(null);
          setDirectApiUrl(null);
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
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
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
          {viewerSrc && !loading && (
            <>
              {useDirectUrl && directApiUrl && (
                <div className="mb-2 flex shrink-0 justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <a href={directApiUrl} target="_blank" rel="noopener noreferrer">
                      פתיחה בחלון חדש
                    </a>
                  </Button>
                </div>
              )}
              {useDirectUrl ? (
                <embed
                  title="תצוגת PDF"
                  src={viewerSrc}
                  type="application/pdf"
                  className="min-h-[70vh] w-full flex-1 rounded-lg border border-slate-200"
                />
              ) : (
                <iframe
                  title="תצוגת PDF"
                  src={viewerSrc}
                  className="min-h-[70vh] w-full flex-1 rounded-lg border border-slate-200"
                />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
