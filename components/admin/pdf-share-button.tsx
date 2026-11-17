"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BRAND_NAME } from "@/lib/brand";
import { syncAppSessionCookie } from "@/lib/sync-app-session";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

function IconShare({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98" />
      <path d="m15.41 6.51-6.82 3.98" />
    </svg>
  );
}

function pdfDownloadApiUrl(
  questionId: string,
  forParam: "asker" | "archive",
  cacheBust: string
): string {
  return `/api/questions/${questionId}/pdf/download?for=${forParam}&cb=${encodeURIComponent(cacheBust)}`;
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1]).trim() || fallback;
    } catch {
      /* ignore */
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain?.[1]?.trim() || fallback;
}

function canShareFiles(file: File): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** יוצר קובץ .eml עם PDF מצורף — נפתח בתוכנת המייל עם הצרופה */
function buildEmlWithPdfAttachment(opts: {
  subject: string;
  body: string;
  file: File;
  pdfBase64: string;
}): Blob {
  const boundary = `----=_Part_${Date.now().toString(36)}`;
  const safeName = opts.file.name.replace(/["\r\n]/g, "_") || "response.pdf";
  const subjectBytes = new TextEncoder().encode(opts.subject);
  let subjectBinary = "";
  for (let i = 0; i < subjectBytes.length; i++) {
    subjectBinary += String.fromCharCode(subjectBytes[i]!);
  }
  const encodedSubject = `=?UTF-8?B?${btoa(subjectBinary)}?=`;

  // פיצול base64 לשורות של 76 תווים (RFC)
  const b64Lines = opts.pdfBase64.replace(/(.{1,76})/g, "$1\r\n").trimEnd();

  const eml = [
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    opts.body,
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${safeName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${safeName}"`,
    "",
    b64Lines,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return new Blob([eml], { type: "message/rfc822" });
}

function openBlobAsDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function fetchPdfFile(
  questionId: string,
  forParam: "asker" | "archive",
  cacheBust: string,
  fallbackName: string
): Promise<File> {
  await syncAppSessionCookie();
  const res = await fetch(pdfDownloadApiUrl(questionId, forParam, cacheBust), {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(res.status === 404 ? "קובץ PDF לא נמצא" : "לא ניתן לטעון את ה-PDF");
  }
  const blob = await res.blob();
  const name = filenameFromDisposition(
    res.headers.get("Content-Disposition"),
    fallbackName
  );
  return new File([blob], name, { type: "application/pdf" });
}

export interface PdfShareButtonProps {
  questionId: string;
  forParam?: "asker" | "archive";
  pdfGeneratedAt?: string | null;
  title?: string | null;
  shortId?: string | null;
  className?: string;
  buttonClassName?: string;
  showLabel?: boolean;
  size?: "sm" | "default";
  variant?: "outline" | "default";
}

export function PdfShareButton({
  questionId,
  forParam = "archive",
  pdfGeneratedAt,
  title,
  shortId,
  className,
  buttonClassName,
  showLabel = false,
  size = "sm",
  variant = "outline",
}: PdfShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<"whatsapp" | "email" | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<{
    file: File;
    pdfBase64: string;
  } | null>(null);

  const cacheBust = pdfGeneratedAt ?? String(Date.now());
  const displayTitle = (title ?? "").trim() || shortId || "תשובה";
  const fallbackFilename = `${displayTitle}.pdf`;
  const shareText = `תשובה מ${BRAND_NAME} — ${displayTitle}`;
  const emailBody = `שלום,\n\nמצורפת תשובה: ${displayTitle}\n`;

  // טעינה מראש בזמן שהחלון פתוח — כדי שבלחיצה על וואטסאפ/אימייל יישאר "user gesture" לשיתוף עם קובץ
  useEffect(() => {
    if (!open) {
      setPrepared(null);
      setLoadingFile(false);
      setError(null);
      setHint(null);
      setPending(null);
      return;
    }

    let cancelled = false;
    setLoadingFile(true);
    setError(null);
    setHint(null);
    setPrepared(null);

    (async () => {
      try {
        const file = await fetchPdfFile(
          questionId,
          forParam,
          cacheBust,
          fallbackFilename
        );
        const pdfBase64 = arrayBufferToBase64(await file.arrayBuffer());
        if (cancelled) return;
        setPrepared({ file, pdfBase64 });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "שגיאה בטעינת ה-PDF");
        }
      } finally {
        if (!cancelled) setLoadingFile(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, questionId, forParam, cacheBust, fallbackFilename]);

  const shareViaSystemSheet = async (file: File) => {
    await navigator.share({
      title: shareText,
      text: shareText,
      files: [file],
    });
  };

  const shareWhatsApp = async () => {
    if (!prepared) return;
    setPending("whatsapp");
    setError(null);
    setHint(null);
    try {
      // שיתוף מערכת עם הקובץ — המשתמשת בוחרת וואטסאפ מהרשימה (הצרופה מצורפת אוטומטית)
      if (canShareFiles(prepared.file)) {
        await shareViaSystemSheet(prepared.file);
        setOpen(false);
        return;
      }
      setError(
        "במחשב זה הדפדפן לא מאפשר צירוף אוטומטי לוואטסאפ. נסי Chrome/Edge מעודכן, או שתפי מהטלפון."
      );
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "שגיאה בשיתוף לוואטסאפ");
    } finally {
      setPending(null);
    }
  };

  const shareEmail = async () => {
    if (!prepared) return;
    setPending("email");
    setError(null);
    setHint(null);
    try {
      // אם יש שיתוף מערכת עם קבצים — אותו מנגנון (בחירת אפליקציית מייל)
      if (canShareFiles(prepared.file)) {
        await shareViaSystemSheet(prepared.file);
        setOpen(false);
        return;
      }

      // נפילה חזרה: קובץ .eml עם PDF מצורף — נפתח בתוכנת המייל עם הצרופה
      const eml = buildEmlWithPdfAttachment({
        subject: shareText,
        body: emailBody,
        file: prepared.file,
        pdfBase64: prepared.pdfBase64,
      });
      const emlName = `${displayTitle.replace(/[<>:"/\\|?*]/g, "_").slice(0, 80) || "share"}.eml`;
      openBlobAsDownload(eml, emlName);
      setHint("נפתח/הורד קובץ מייל עם ה-PDF מצורף. פתחי אותו בתוכנת המייל במחשב.");
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "שגיאה בשיתוף באימייל");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className={cn("inline-flex", className)}>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn("gap-1.5", buttonClassName)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="שיתוף PDF"
      >
        <IconShare className="h-4 w-4 shrink-0" />
        {showLabel ? <span>שיתוף</span> : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm" dir="rtl" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>שיתוף תשובה (PDF)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-start">
            <p className="text-sm text-slate-600">
              בחרי ערוץ — הקובץ יצטרף אוטומטית להודעה (בלי צירוף ידני).
            </p>
            {loadingFile && (
              <p className="text-sm text-slate-500" role="status">
                מכין את קובץ ה-PDF…
              </p>
            )}
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            {hint && !error && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
                {hint}
              </p>
            )}
          </div>
          <DialogFooter className="flex-row flex-wrap justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-green-300 text-green-800 hover:bg-green-50"
              onClick={shareWhatsApp}
              disabled={pending !== null || loadingFile || !prepared}
            >
              {pending === "whatsapp" ? "פותח…" : "וואטסאפ"}
            </Button>
            <Button
              type="button"
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={shareEmail}
              disabled={pending !== null || loadingFile || !prepared}
            >
              {pending === "email" ? "פותח…" : "אימייל"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
