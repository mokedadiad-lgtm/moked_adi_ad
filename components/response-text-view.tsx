"use client";

import {
  compactResponseHtmlForQueue,
  parseResponseRich,
  sanitizeResponseHtml,
} from "@/lib/response-text";

interface ResponseTextViewProps {
  value: string | null | undefined;
  className?: string;
  variant?: "default" | "compact";
}

/**
 * Renders stored response (rich HTML + footnotes) like the respondent wrote it:
 * RTL, headings, bold, footnote refs [1] [2], and footnotes section below.
 */
export function ResponseTextView({
  value,
  className = "",
  variant = "default",
}: ResponseTextViewProps) {
  if (!value || !value.trim()) {
    return <span className="text-secondary">—</span>;
  }
  const { bodyHtml, footnotes } = parseResponseRich(value);
  const safeHtml = sanitizeResponseHtml(bodyHtml);
  const htmlForRender =
    variant === "compact" ? compactResponseHtmlForQueue(safeHtml) : safeHtml;
  if (!safeHtml.trim() && footnotes.length === 0) {
    return <span className="text-secondary">—</span>;
  }

  return (
    <div className={className} dir="rtl">
      <div
        className={
          variant === "compact"
            ? // תור: טיפוגרפיה ב-globals.css (.response-text-queue) + inline ב-compactResponseHtmlForQueue
              "response-text-queue [&_p]:mb-2 [&_div]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-1 [&_blockquote]:mb-2 [&_sup]:font-medium [&_sup]:text-primary"
            : "text-start [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold [&_sup]:font-medium [&_sup]:text-primary"
        }
        dangerouslySetInnerHTML={{ __html: htmlForRender }}
      />
      {footnotes.length > 0 && (
        <div className="mt-4 rounded-xl border border-card-border bg-slate-50/80 p-4">
          <p className="mb-3 text-sm font-semibold text-primary text-start">הערות שוליים</p>
          <div className="flex flex-col gap-2">
            {footnotes.map((fn, i) => (
              <div key={fn.id} className="flex items-start gap-2 text-start" dir="rtl">
                <span className="shrink-0 text-sm font-medium text-primary">[{i + 1}]</span>
                <span className="text-sm text-secondary">{fn.text ?? ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
