import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  decodeHtmlEntities,
  inferBaseDirFromText,
  sanitizeResponseHtmlForPdf,
} from "@/lib/response-text";

const base = StyleSheet.create({
  wrapRtl: { direction: "rtl" as const, textAlign: "justify" as const, width: "100%" },
  wrapLtr: { direction: "ltr" as const, textAlign: "justify" as const, width: "100%" },
  p: {
    fontSize: 11,
    lineHeight: 1.45,
    marginBottom: 8,
    color: "#2C2C54",
    fontFamily: "Heebo",
  },
  h1: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 8,
    marginBottom: 4,
    color: "#2C2C54",
    fontFamily: "Heebo",
  },
  h2: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 7,
    marginBottom: 3,
    color: "#2C2C54",
    fontFamily: "Heebo",
  },
  h3: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 6,
    marginBottom: 3,
    color: "#3F3D56",
    fontFamily: "Heebo",
  },
  quoteRtl: {
    fontSize: 11,
    lineHeight: 1.4,
    marginBottom: 8,
    paddingRight: 10,
    borderRightWidth: 2,
    borderRightColor: "#E8E0E5",
    color: "#5C5C78",
    fontFamily: "Heebo",
  },
  quoteLtr: {
    fontSize: 11,
    lineHeight: 1.4,
    marginBottom: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#E8E0E5",
    color: "#5C5C78",
    fontFamily: "Heebo",
  },
  liRtl: {
    fontSize: 11,
    lineHeight: 1.45,
    marginBottom: 3,
    paddingRight: 8,
    color: "#2C2C54",
    fontFamily: "Heebo",
  },
  liLtr: {
    fontSize: 11,
    lineHeight: 1.45,
    marginBottom: 3,
    paddingLeft: 8,
    color: "#2C2C54",
    fontFamily: "Heebo",
  },
  bold: { fontWeight: 700, fontFamily: "Heebo" },
  italic: { fontStyle: "italic" as const, fontFamily: "Heebo" },
  sup: { fontSize: 7, fontFamily: "Heebo" },
  answerHeading: { color: "#AD1457" },
  dirRtl: { direction: "rtl" as const, textAlign: "justify" as const },
  dirLtr: { direction: "ltr" as const, textAlign: "justify" as const },
});

const RTL = "\u200F";
const LTR = "\u200E";

type Segment = { text: string; bold?: boolean; italic?: boolean; sup?: boolean };

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function parseInline(html: string): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  let bold = 0;
  let italic = 0;
  let buf = "";

  const flush = () => {
    if (buf.length === 0) return;
    const text = decodeHtmlEntities(buf);
    out.push({
      text,
      bold: bold > 0,
      italic: italic > 0,
    });
    buf = "";
  };

  while (pos < html.length) {
    if (html[pos] !== "<") {
      buf += html[pos]!;
      pos++;
      continue;
    }
    const tagEnd = html.indexOf(">", pos);
    if (tagEnd === -1) {
      buf += html.slice(pos);
      break;
    }
    const fullTag = html.slice(pos, tagEnd + 1);
    pos = tagEnd + 1;
    const tagMatch = /^<\/?([a-z0-9]+)/i.exec(fullTag);
    if (!tagMatch) {
      buf += fullTag;
      continue;
    }
    const tn = tagMatch[1]!.toLowerCase();
    const closing = fullTag.startsWith("</");

    if (tn === "br") {
      flush();
      out.push({ text: "\n\n", bold: bold > 0, italic: italic > 0 });
      continue;
    }
    if (tn === "strong" || tn === "b") {
      flush();
      if (closing) bold = Math.max(0, bold - 1);
      else bold++;
      continue;
    }
    if (tn === "em" || tn === "i") {
      flush();
      if (closing) italic = Math.max(0, italic - 1);
      else italic++;
      continue;
    }
    if (tn === "sup" && !closing) {
      flush();
      const closeIdx = html.indexOf("</sup>", pos);
      if (closeIdx === -1) continue;
      const inner = html.slice(pos, closeIdx);
      pos = closeIdx + 6;
      out.push({
        text: decodeHtmlEntities(stripTags(inner)),
        bold: bold > 0,
        italic: italic > 0,
        sup: true,
      });
      continue;
    }
    if (tn === "u") {
      flush();
      if (!closing) {
        const closeIdx = html.indexOf("</u>", pos);
        if (closeIdx !== -1) {
          const inner = html.slice(pos, closeIdx);
          pos = closeIdx + 4;
          out.push({ text: decodeHtmlEntities(stripTags(inner)), bold: bold > 0, italic: italic > 0 });
        }
      }
      continue;
    }
  }
  flush();
  return out;
}

type Block = {
  tag: string;
  segments: Segment[];
  answerHeading?: boolean;
  listKind?: "ordered" | "unordered";
  listIndex?: number;
};

function parseBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  let src = html
    .trim()
    .replace(/<div\s+class="answer-sep"[^>]*>\s*<\/div>/gi, "")
    .replace(/<hr\s+class="answer-sep"[^>]*\/?>/gi, "");

  const tryMatch = (s: string) => {
    return /^<(p|div|h1|h2|h3|blockquote|li)(\s[^>]*)?>([\s\S]*?)<\/\1>/i.exec(s);
  };

  while (src.length) {
    src = src.trimStart();
    if (!src) break;

    const m = tryMatch(src);
    if (m) {
      const tag = m[1]!.toLowerCase();
      const attrs = m[2] ?? "";
      let inner = m[3] ?? "";
      if (tag === "div" && /<(?:p|h[123]|blockquote|li)\b/i.test(inner)) {
        blocks.push(...parseBlocks(inner));
        src = src.slice(m[0]!.length);
        continue;
      }
      const isAnswerHeading = /class="[^"]*answer-heading/.test(attrs);
      blocks.push({
        tag,
        segments: parseInline(inner),
        answerHeading: isAnswerHeading,
      });
      src = src.slice(m[0]!.length);
      continue;
    }

    const ul = /^<ul[^>]*>([\s\S]*?)<\/ul>/i.exec(src);
    if (ul) {
      const inner = ul[1] ?? "";
      const liRe = /<li(\s[^>]*)?>([\s\S]*?)<\/li>/gi;
      let lm: RegExpExecArray | null;
      let idx = 0;
      while ((lm = liRe.exec(inner))) {
        idx++;
        blocks.push({
          tag: "li",
          segments: parseInline(lm[2] ?? ""),
          listKind: "unordered",
          listIndex: idx,
        });
      }
      src = src.slice(ul[0]!.length);
      continue;
    }

    const ol = /^<ol[^>]*>([\s\S]*?)<\/ol>/i.exec(src);
    if (ol) {
      const inner = ol[1] ?? "";
      const liRe = /<li(\s[^>]*)?>([\s\S]*?)<\/li>/gi;
      let lm: RegExpExecArray | null;
      let idx = 0;
      while ((lm = liRe.exec(inner))) {
        idx++;
        blocks.push({
          tag: "li",
          segments: parseInline(lm[2] ?? ""),
          listKind: "ordered",
          listIndex: idx,
        });
      }
      src = src.slice(ol[0]!.length);
      continue;
    }

    const next = src.indexOf("<");
    if (next === -1) {
      blocks.push({ tag: "p", segments: parseInline(src) });
      break;
    }
    if (next > 0) {
      blocks.push({ tag: "p", segments: parseInline(src.slice(0, next)) });
      src = src.slice(next);
      continue;
    }
    const orphan = /^<[^>]+>/.exec(src);
    if (orphan) {
      src = src.slice(orphan[0]!.length);
      continue;
    }
    break;
  }
  return blocks;
}

function SegmentLine({ seg }: { seg: Segment }) {
  const styles = [
    ...(seg.bold ? [base.bold] : []),
    ...(seg.italic ? [base.italic] : []),
  ];
  if (seg.sup) {
    return (
      <Text style={[base.sup, ...(seg.bold ? [base.bold] : [])]}>
        {seg.text}
      </Text>
    );
  }
  return (
    <Text style={styles.length ? styles : undefined}>
      {seg.text.split("\n").map((line, j) => (
        <React.Fragment key={j}>
          {j > 0 ? "\n" : null}
          {line}
        </React.Fragment>
      ))}
    </Text>
  );
}

function blockPlainText(block: Block): string {
  return block.segments.map((s) => s.text).join("");
}

function BlockView({ block }: { block: Block }) {
  const dir = inferBaseDirFromText(blockPlainText(block));
  const isLtr = dir === "ltr";
  const mark = isLtr ? LTR : RTL;
  const dirStyle = isLtr ? base.dirLtr : base.dirRtl;

  const style =
    block.tag === "h1"
      ? [base.h1, dirStyle]
      : block.tag === "h2"
        ? [base.h2, dirStyle]
        : block.tag === "h3"
          ? block.answerHeading
            ? [base.h3, base.answerHeading, dirStyle]
            : [base.h3, dirStyle]
          : block.tag === "blockquote"
            ? [isLtr ? base.quoteLtr : base.quoteRtl, dirStyle]
            : block.tag === "li"
              ? [isLtr ? base.liLtr : base.liRtl, dirStyle]
              : [base.p, dirStyle];

  return (
    <Text style={style}>
      {mark}
      {block.tag === "li" ? (
        block.listKind === "ordered" ? `${block.listIndex ?? 1}. ` : "• "
      ) : null}
      {block.segments.map((seg, i) => (
        <SegmentLine key={i} seg={seg} />
      ))}
    </Text>
  );
}

/** תוכן תשובה מ-HTML מסונן ל-react-pdf (מודגש, כותרות, הערות שוליים כעילית) */
export function PdfAnswerBodyFromHtml({
  html,
  fallbackPlain,
}: {
  html: string;
  /** אם אין בלוקים אחרי פירוק — מציג טקסט שטוח (מ־responseToStructured) */
  fallbackPlain?: string;
}) {
  const safe = sanitizeResponseHtmlForPdf(html || "");
  const blocks = parseBlocks(safe);

  if (blocks.length === 0) {
    const plain =
      decodeHtmlEntities(stripTags(safe)).trim() || (fallbackPlain ?? "").trim();
    if (!plain) return null;
    const dir = inferBaseDirFromText(plain);
    const isLtr = dir === "ltr";
    return (
      <View style={isLtr ? base.wrapLtr : base.wrapRtl}>
        <Text style={[base.p, isLtr ? base.dirLtr : base.dirRtl]}>
          {isLtr ? LTR : RTL}
          {plain}
        </Text>
      </View>
    );
  }

  const overall = inferBaseDirFromText(blocks.map(blockPlainText).join(" "));
  return (
    <View style={overall === "ltr" ? base.wrapLtr : base.wrapRtl}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </View>
  );
}

/** לבדיקות יחידה — פירוק בלוקים כמו ב־react-pdf fallback */
export { parseBlocks };
