"use client";

import type { ReactNode } from "react";

/**
 * Renders WhatsApp-style emphasis: *segment* → <strong>.
 * Used in admin demo; production WhatsApp receives the same string with asterisks.
 */
export function WhatsAppBoldText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const re = /\*([^*]+)\*/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    nodes.push(
      <strong key={key++} className="font-semibold text-slate-900">
        {m[1]}
      </strong>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return <span className={className}>{nodes.length ? nodes : text}</span>;
}
