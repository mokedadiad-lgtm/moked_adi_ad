"use client";

import { WhatsAppBoldText } from "@/components/admin/whatsapp-bold-text";
import type { DemoBubble } from "@/lib/whatsapp/botFlowDemoScript";
import { WA_INTERACTIVE_BODY_BUTTONS_ONLY } from "@/lib/whatsapp/waInteractive";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

type Props = {
  bubblesM: DemoBubble[];
  bubblesF: DemoBubble[];
};

export function WhatsappBotDemoClient({ bubblesM, bubblesF }: Props) {
  const [gender, setGender] = useState<"M" | "F">("F");
  const bubbles = useMemo(
    () => (gender === "M" ? bubblesM : bubblesF),
    [gender, bubblesM, bubblesF]
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100/80 pb-10" dir="rtl">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">דוגמת התכתבות עם הבוט</h1>
            <p className="mt-1 text-sm text-slate-600">
              תצוגה סטטית של מסלול &quot;שאלה במוקד&quot; — הטקסטים נלקחים מאותם מקורות כמו בבוט (
              <code className="rounded bg-slate-200/80 px-1 text-xs">WHATSAPP_BOT_TEXTS.md</code>
              ).
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-xs font-medium text-slate-500">מגדר בדמו</span>
            <button
              type="button"
              onClick={() => setGender("F")}
              className={cn(
                "rounded-lg px-3 py-1 text-sm font-medium transition-colors",
                gender === "F" ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              נקבה
            </button>
            <button
              type="button"
              onClick={() => setGender("M")}
              className={cn(
                "rounded-lg px-3 py-1 text-sm font-medium transition-colors",
                gender === "M" ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              זכר
            </button>
          </div>
        </div>

        <div
          className="rounded-2xl border border-slate-200/80 shadow-inner"
          style={{ background: "linear-gradient(180deg, #d9fdd3 0%, #e5ddd5 12%, #e5ddd5 100%)" }}
        >
          <div className="flex max-h-[min(78vh,720px)] flex-col gap-2 overflow-y-auto px-3 py-4">
            {bubbles.map((b, i) => (
              <DemoBubbleRow key={i} bubble={b} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoBubbleRow({ bubble }: { bubble: DemoBubble }) {
  if (bubble.side === "user") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] rounded-lg rounded-tr-sm bg-[#dcf8c6] px-3 py-2 text-sm text-slate-900 shadow-sm">
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            <WhatsAppBoldText text={bubble.body} />
          </p>
        </div>
      </div>
    );
  }

  if (bubble.kind === "text") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-sm text-slate-900 shadow-sm">
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            <WhatsAppBoldText text={bubble.body} />
          </p>
        </div>
      </div>
    );
  }

  if (bubble.kind === "buttons") {
    const showBody =
      bubble.body !== WA_INTERACTIVE_BODY_BUTTONS_ONLY &&
      bubble.body.replace(/[\u200b-\u200d\ufeff]/g, "").trim() !== "";
    return (
      <div className="flex justify-end">
        <div className="max-w-[95%] overflow-hidden rounded-lg bg-white shadow-sm">
          {showBody ? (
            <div className="border-b border-slate-100 px-3 py-2.5 text-sm text-slate-900">
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                <WhatsAppBoldText text={bubble.body} />
              </p>
            </div>
          ) : null}
          <div
            className={cn(
              "flex flex-col gap-0 divide-y divide-slate-100 bg-[#f7f8fa]",
              !showBody && "rounded-t-lg"
            )}
          >
            {bubble.buttons.map((btn) => (
              <div
                key={btn.id}
                className="px-3 py-2.5 text-center text-sm font-medium text-[#027eb5]"
                title={btn.id}
              >
                {btn.title}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // list
  return (
    <div className="flex justify-end">
      <div className="max-w-[95%] overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="border-b border-slate-100 px-3 py-2.5 text-sm text-slate-900">
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            <WhatsAppBoldText text={bubble.body} />
          </p>
        </div>
        <div className="bg-[#f7f8fa] px-3 py-2">
          <p className="mb-2 text-center text-xs font-medium text-slate-500">{bubble.sectionTitle}</p>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {bubble.rows.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-slate-200/80 bg-white px-2 py-1.5 text-right shadow-sm"
              >
                {r.title}
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-lg border border-[#027eb5]/30 bg-white py-2 text-center text-sm font-medium text-[#027eb5]">
            {bubble.buttonText} ▾
          </div>
        </div>
      </div>
    </div>
  );
}
