"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

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

function newFootnoteId(index: number): string {
  const rnd =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2, 12)}`;
  return `fn-${Date.now()}-${index}-${rnd}`;
}

/**
 * כשמועתקים/מודבקים sup עם אותו data-fn-id — יש כפילויות ב-DOM.
 * מתקן מזהים כפולים (הופעה שנייה ואילך מקבלת מזהה חדש + העתקת טקסט הערה).
 */
function dedupeFootnoteMarkers(
  container: HTMLElement,
  footnoteTexts: Record<string, string>
): { ids: string[]; footnoteTexts: Record<string, string>; hadDuplicateIds: boolean } {
  const markers = [...container.querySelectorAll("[data-fn-id]")] as HTMLElement[];
  const seenIds = new Set<string>();
  const ids: string[] = [];
  const nextTexts = { ...footnoteTexts };
  let hadDuplicateIds = false;

  markers.forEach((el, index) => {
    let id = el.getAttribute("data-fn-id");
    if (!id) return;
    if (seenIds.has(id)) {
      hadDuplicateIds = true;
      const newId = newFootnoteId(index);
      el.setAttribute("data-fn-id", newId);
      nextTexts[newId] = nextTexts[id] ?? "";
      id = newId;
    }
    seenIds.add(id);
    ids.push(id);
    el.textContent = `[${ids.length}]`;
  });

  return { ids, footnoteTexts: nextTexts, hadDuplicateIds };
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
  /** אחרי onChange מקומי — לא להידרר מחדש מה-prop value (מונע דריסת הקלדה) */
  const skipNextValueHydrationRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const renumberAndCapture = useCallback(() => {
    if (!ref.current) return;
    const { ids, footnoteTexts: nextTexts } = dedupeFootnoteMarkers(ref.current, footnoteTexts);
    setOrderedFnIds(ids);
    setFootnoteTexts(nextTexts);
    const bodyHtml = ref.current.innerHTML;
    skipNextValueHydrationRef.current = true;
    onChange(serialize(bodyHtml, ids, nextTexts));
  }, [onChange, footnoteTexts]);

  const capture = useCallback(() => {
    renumberAndCapture();
  }, [renumberAndCapture]);

  /** הידרציה מ־value (טעינה ראשונית, רענון מהשרת, מעבר שאלה דרך key) — לא אחרי הקלדה שלנו */
  useLayoutEffect(() => {
    if (!ref.current) return;
    if (skipNextValueHydrationRef.current) {
      skipNextValueHydrationRef.current = false;
      return;
    }
    const { body, footnoteTexts: initial } = parseValue(value);
    ref.current.innerHTML = body || "";
    const { ids, footnoteTexts: next, hadDuplicateIds } = dedupeFootnoteMarkers(ref.current, initial);
    setOrderedFnIds(ids);
    setFootnoteTexts(next);
    if (hadDuplicateIds) {
      skipNextValueHydrationRef.current = true;
      onChangeRef.current(serialize(ref.current.innerHTML, ids, next));
    }
    // רק value — לא onChange (ההורה מעבירה פונקציה חדשה בכל רינדור)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const undoLast = useCallback(() => {
    if (!ref.current || disabled) return;
    ref.current.focus();
    document.execCommand("undo", false);
    capture();
  }, [capture, disabled]);

  const toggleHeading = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const findBlock = (node: Node | null): HTMLElement | null => {
      let n: Node | null = node;
      while (n && n !== root) {
        if (n.nodeType === Node.ELEMENT_NODE) {
          const el = n as HTMLElement;
          const t = el.tagName;
          if (t === "P" || t === "DIV" || t === "H1" || t === "H2" || t === "H3" || t === "BLOCKQUOTE" || t === "LI") {
            return el;
          }
        }
        n = n.parentNode;
      }
      return null;
    };

    const isHeadingTag = (el: HTMLElement) => /^H[1-6]$/.test(el.tagName);

    /** תו משמעותי ראשון בבלוק — כדי לא לכלול בלוק הבא כשהסימון מסתיים ברווח לפני התוכן שלו */
    const firstMeaningfulPointInBlock = (block: HTMLElement): { node: Text; offset: number } | null => {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const t = n as Text;
        const s = t.textContent ?? "";
        const i = s.search(/\S/);
        if (i !== -1) return { node: t, offset: i };
      }
      return null;
    };

    /** בלוק שבו הסימון מסתיים לפני התוכן המשמעותי — לא להפוך לכותרת (רווח בסוף סימון ש"נוגע" בבלוק הבא) */
    const blockIsSubstantiallySelected = (range: Range, block: HTMLElement): boolean => {
      if (!range.intersectsNode(block)) return false;
      const first = firstMeaningfulPointInBlock(block);
      if (!first) return true;
      try {
        if (range.comparePoint(first.node, first.offset) > 0) return false;
      } catch {
        return true;
      }
      return true;
    };

    /** כל בלוקי התוכן שחותכים את הבחירה — העמוקים ביותר (בלי אב שגם מועמד), בסדר מסמך */
    const collectBlocksInRange = (range: Range): HTMLElement[] => {
      const selector = "p, h1, h2, h3, h4, h5, h6, blockquote, li, div";
      const candidates: HTMLElement[] = [];
      root.querySelectorAll(selector).forEach((el) => {
        const h = el as HTMLElement;
        if (!range.intersectsNode(h)) return;
        candidates.push(h);
      });

      const innermost = candidates.filter((el) => {
        return !candidates.some((other) => other !== el && other.contains(el));
      });

      innermost.sort((a, b) => {
        const pos = a.compareDocumentPosition(b);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });

      return innermost;
    };

    const range = sel.getRangeAt(0).cloneRange();

    /** כשמסמנים טקסט חלקי (לא בלוק שלם), נעטוף אותו ישירות ב-h2 במקום להסתמך על execCommand */
    const wrapSelectionWithHeading = (selectionRange: Range): boolean => {
      if (selectionRange.collapsed) return false;
      const selectedText = selectionRange.toString().replace(/\s+/g, " ").trim();
      if (!selectedText) return false;
      try {
        const h = document.createElement("h2");
        h.appendChild(selectionRange.extractContents());
        selectionRange.insertNode(h);
        const after = document.createRange();
        after.setStartAfter(h);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
        return true;
      } catch {
        return false;
      }
    };

    const hasNonCollapsedSelection = !range.collapsed && range.toString().replace(/\s+/g, " ").trim().length > 0;

    if (hasNonCollapsedSelection) {
      if (wrapSelectionWithHeading(range)) {
        root.focus();
        skipNextValueHydrationRef.current = true;
        capture();
      }
      return;
    }

    let blocks = collectBlocksInRange(range).filter((b) => blockIsSubstantiallySelected(range, b));

    if (blocks.length === 0) {
      const startBlock = findBlock(range.startContainer);
      const endBlock = findBlock(range.endContainer);
      if (startBlock && endBlock && startBlock === endBlock) {
        if (blockIsSubstantiallySelected(range, startBlock)) blocks = [startBlock];
      } else if (startBlock && !endBlock) {
        blocks = [startBlock];
      }
    }

    if (blocks.length === 0) {
      const hasBlockEl = root.querySelector("p, div, h1, h2, h3, h4, h5, h6, blockquote, li");
      if (!hasBlockEl && (root.textContent?.trim() || root.innerHTML.trim())) {
        const h = document.createElement("h2");
        while (root.firstChild) h.appendChild(root.firstChild);
        root.appendChild(h);
        blocks = [h];
      }
    }

    if (blocks.length === 0) {
      if (wrapSelectionWithHeading(range)) {
        root.focus();
        skipNextValueHydrationRef.current = true;
        capture();
        return;
      }
      exec("formatBlock", "h2");
      return;
    }

    const allHeadings = blocks.every(isHeadingTag);
    const targetTag = allHeadings ? "p" : "h2";

    const newBlocks: HTMLElement[] = [];
    for (const block of blocks) {
      if (block.tagName.toLowerCase() === targetTag) {
        newBlocks.push(block);
        continue;
      }
      const next = document.createElement(targetTag);
      while (block.firstChild) {
        next.appendChild(block.firstChild);
      }
      block.parentNode?.replaceChild(next, block);
      newBlocks.push(next);
    }

    try {
      const r = document.createRange();
      const first = newBlocks[0]!;
      const last = newBlocks[newBlocks.length - 1]!;
      r.setStartBefore(first);
      r.setEndAfter(last);
      sel.removeAllRanges();
      sel.addRange(r);
    } catch {
      /* ignore */
    }

    root.focus();
    skipNextValueHydrationRef.current = true;
    capture();
  }, [capture, exec]);

  const insertFootnote = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const id = newFootnoteId(0);
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
        skipNextValueHydrationRef.current = true;
        onChange(serialize(ref.current.innerHTML, orderedFnIds, next));
      }
    },
    [footnoteTexts, orderedFnIds, onChange]
  );

  return (
    <div className={className}>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-t-xl border border-b-0 border-card-border bg-slate-100 p-2 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-slate-100/95">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={undoLast}
          disabled={disabled}
          className="rounded px-2 py-1 text-sm hover:bg-slate-200 disabled:opacity-50"
          title="בטל את הפעולה האחרונה (Ctrl+Z)"
        >
          בטל פעולה
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("bold")}
          disabled={disabled}
          className="rounded px-2 py-1 text-sm font-bold hover:bg-slate-200 disabled:opacity-50"
          title="מודגש"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleHeading}
          disabled={disabled}
          className="rounded px-2 py-1 text-sm hover:bg-slate-200 disabled:opacity-50"
          title="הפוך לכותרת / אם הסמן בכותרת – בטל כותרת"
        >
          כותרת
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
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
        className="min-h-[3rem] max-h-[400px] overflow-y-auto w-full rounded-b-xl border border-card-border bg-white p-4 text-start text-base focus:outline-none focus:ring-2 focus:ring-primary/20 [&_h2]:!text-xl [&_h2]:!font-bold [&_h2_strong]:!text-xl [&_h3]:!text-lg [&_h3]:font-semibold [&_h3_strong]:!text-lg"
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
              <div key={`${id}-${i}`} className="flex items-start gap-2 text-start">
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
