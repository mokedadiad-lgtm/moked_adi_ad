"use client";

import { sanitizeSignatureHtml } from "@/lib/response-text";
import { useCallback, useEffect, useRef } from "react";

export interface SignatureRichFieldProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * שדה חתימה ל-PDF: טקסט LTR עם מודגש (בלבד). שומר HTML מסונן.
 */
export function SignatureRichField({
  value,
  onChange,
  disabled,
  placeholder = "",
  className = "",
}: SignatureRichFieldProps) {
  const ref = useRef<HTMLDivElement>(null);

  const capture = useCallback(() => {
    if (!ref.current) return;
    onChange(sanitizeSignatureHtml(ref.current.innerHTML));
  }, [onChange]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const next = sanitizeSignatureHtml(value);
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [value]);

  const bold = useCallback(() => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand("bold", false);
    capture();
  }, [disabled, capture]);

  return (
    <div className={className} dir="ltr">
      <div className="flex flex-wrap items-center gap-2 rounded-t-xl border border-b-0 border-card-border bg-slate-100 px-2 py-1.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={bold}
          disabled={disabled}
          className="rounded px-2.5 py-1 text-sm font-bold hover:bg-slate-200 disabled:opacity-50"
          title="מודגש"
        >
          B
        </button>
      </div>
      <div
        ref={ref}
        contentEditable={!disabled}
        dir="ltr"
        style={{ direction: "ltr", textAlign: "left", unicodeBidi: "plaintext" }}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={capture}
        onBlur={capture}
        className="min-h-[72px] max-h-[200px] overflow-y-auto w-full rounded-b-xl border border-card-border bg-white px-3 py-2 text-left text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 [&_b]:font-bold [&_strong]:font-bold"
      />
    </div>
  );
}
