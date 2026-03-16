"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FOOTNOTES_MARKER = "data-footnotes-json";

function parseValue(value: string): { body: string; footnoteTexts: Record<string, string> } {
  const footnoteTexts: Record<string, string> = {};
  if (!value || !value.trim()) return { body: "", footnoteTexts };
  const el = document.createElement("div");
  el.innerHTML = value;
  const fnDiv = el.querySelector(`[${FOOTNOTES_MARKER}]`);
  if (fnDiv) {
    try {
      const arr = JSON.parse(fnDiv.getAttribute(FOOTNOTES_MARKER) || "[]") as { id: string; text: string }[];
      arr.forEach(({ id, text }) => {
        footnoteTexts[id] = text ?? "";
      });
      fnDiv.remove();
    } catch {
      // ignore
    }
  }
  return { body: el.innerHTML, footnoteTexts };
}

function serialize(bodyHtml: string, orderedIds: string[], footnoteTexts: Record<string, string>): string {
  const arr = orderedIds.map((id) => ({ id, text: footnoteTexts[id] ?? "" }));
  const div = document.createElement("div");
  div.setAttribute(FOOTNOTES_MARKER, JSON.stringify(arr));
  div.style.display = "none";
  const wrap = document.createElement("div");
  wrap.innerHTML = bodyHtml;
  wrap.appendChild(div);
  return wrap.innerHTML;
}

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "",
  disabled,
  className = "",
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [footnoteTexts, setFootnoteTexts] = useState<Record<string, string>>({});
  const [orderedFnIds, setOrderedFnIds] = useState<string[]>([]);
  const [focusFootnoteId, setFocusFootnoteId] = useState<string | null>(null);
  const footnoteInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const renumberAndCapture = useCallback(() => {
    if (!ref.current) return;
    const markers = [...ref.current.querySelectorAll("[data-fn-id]")] as HTMLElement[];
    const ids: string[] = [];
    markers.forEach((el, i) => {
      const id = el.getAttribute("data-fn-id");
      if (id) {
        ids.push(id);
        el.textContent = `[${i + 1}]`;
      }
    });
    setOrderedFnIds(ids);
    const bodyHtml = ref.current.innerHTML;
    onChange(serialize(bodyHtml, ids, footnoteTexts));
  }, [onChange, footnoteTexts]);

  const capture = useCallback(() => {
    renumberAndCapture();
  }, [renumberAndCapture]);

  useEffect(() => {
    const { body, footnoteTexts: initial } = parseValue(value);
    if (ref.current) ref.current.innerHTML = body || "";
    if (ref.current) {
      const markers = [...ref.current.querySelectorAll("[data-fn-id]")] as HTMLElement[];
      const ids = markers.map((el) => el.getAttribute("data-fn-id")).filter(Boolean) as string[];
      setOrderedFnIds(ids);
    }
    setFootnoteTexts(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ref.current || !value) return;
    const cur = ref.current.innerHTML.trim();
    const isEmpty = !cur || cur === "<br>" || cur === "<br/>";
    if (!isEmpty) return;
    const { body, footnoteTexts: initial } = parseValue(value);
    ref.current.innerHTML = body;
    const markers = [...ref.current.querySelectorAll("[data-fn-id]")] as HTMLElement[];
    const ids = markers.map((el) => el.getAttribute("data-fn-id")).filter(Boolean) as string[];
    setOrderedFnIds(ids);
    setFootnoteTexts(initial);
  }, [value]);

  // מעבר אוטומטי לשדה ההערה אחרי הוספת הערת שוליים
  useEffect(() => {
    if (!focusFootnoteId || !orderedFnIds.includes(focusFootnoteId)) return;
    const t = setTimeout(() => {
      const el = footnoteInputRefs.current[focusFootnoteId];
      if (el) {
        el.focus();
        setFocusFootnoteId(null);
      }
    }, 50);
    return () => clearTimeout(t);
  }, [focusFootnoteId, orderedFnIds]);

  const exec = useCallback(
    (cmd: string, value?: string) => {
      document.execCommand(cmd, false, value);
      ref.current?.focus();
      capture();
    },
    [capture]
  );

  /** כותרת: אם הסמן בתוך כותרת (h2/h3) – מבטל; אחרת הופך את הבלוק לכותרת */
  const toggleHeading = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node: Node | null = sel.anchorNode;
    let isInsideHeading = false;
    while (node && ref.current) {
      if (node === ref.current) break;
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as Element).tagName;
        if (tag === "H2" || tag === "H3" || tag === "H1") {
          isInsideHeading = true;
          break;
        }
      }
      node = node.parentNode;
    }
    exec("formatBlock", isInsideHeading ? "p" : "h2");
  }, [exec]);

  const insertFootnote = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const id = `fn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const sup = document.createElement("sup");
    sup.className = "fn-ref text-primary font-medium";
    sup.setAttribute("data-fn-id", id);
    sup.contentEditable = "false";
    sup.textContent = "[?]";
    range.insertNode(sup);
    range.collapse(false);
    setFootnoteTexts((prev) => ({ ...prev, [id]: "" }));
    setFocusFootnoteId(id);
    ref.current?.focus();
    setTimeout(capture, 0);
  }, [capture]);

  const setFootnoteText = useCallback(
    (id: string, text: string) => {
      const next = { ...footnoteTexts, [id]: text };
      setFootnoteTexts(next);
      if (ref.current) {
        onChange(serialize(ref.current.innerHTML, orderedFnIds, next));
      }
    },
    [footnoteTexts, orderedFnIds, onChange]
  );

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2 rounded-t-xl border border-b-0 border-card-border bg-slate-100 p-2">
        <button
          type="button"
          onClick={() => exec("bold")}
          disabled={disabled}
          className="rounded px-2 py-1 text-sm font-bold hover:bg-slate-200 disabled:opacity-50"
          title="מודגש"
        >
          B
        </button>
        <button
          type="button"
          onClick={toggleHeading}
          disabled={disabled}
          className="rounded px-2 py-1 text-sm hover:bg-slate-200 disabled:opacity-50"
          title="הפוך לכותרת / אם הסמן בכותרת – בטל כותרת"
        >
          כותרת
        </button>
        <button
          type="button"
          onClick={insertFootnote}
          disabled={disabled}
          className="rounded px-2 py-1 text-sm hover:bg-slate-200 disabled:opacity-50"
          title="עמוד עם הסמן במקום הרצוי ולחץ על כפתור זה להוספת הערת שוליים"
        >
          הערת שוליים
        </button>
      </div>
      <div
        ref={ref}
        contentEditable={!disabled}
        dir="rtl"
        className="min-h-[3rem] max-h-[400px] overflow-y-auto w-full rounded-b-xl border border-card-border bg-white p-4 text-start focus:outline-none focus:ring-2 focus:ring-primary/20 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold"
        onInput={capture}
        onBlur={capture}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      {orderedFnIds.length > 0 && (
        <div className="mt-4 rounded-xl border border-card-border bg-slate-50/80 p-4 text-start">
          <p className="mb-3 text-sm font-semibold text-primary">הערות שוליים</p>
          <div className="flex flex-col gap-2">
            {orderedFnIds.map((id, i) => (
              <div key={id} className="flex items-start gap-2 text-start">
                <span className="mt-2 shrink-0 text-sm font-medium text-primary">[{i + 1}]</span>
                <input
                  ref={(el) => {
                    footnoteInputRefs.current[id] = el;
                  }}
                  type="text"
                  value={footnoteTexts[id] ?? ""}
                  onChange={(e) => setFootnoteText(id, e.target.value)}
                  placeholder={`טקסט להערה ${i + 1}`}
                  disabled={disabled}
                  className="min-h-9 flex-1 rounded-md border border-card-border bg-white px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
