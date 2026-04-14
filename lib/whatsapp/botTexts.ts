import fs from "fs";
import path from "path";

export type Gender = "M" | "F";
export type BotTextStateKey =
  | "start"
  | "gender_invalid_first"
  | "choose_mode"
  | "human_message_collect"
  | "human_handoff"
  | "age"
  | "age_invalid_first"
  | "age_invalid_second"
  | "body_collect"
  | "body_invalid_or_empty"
  | "title_collect"
  | "title_collect_followup"
  | "response_type"
  | "publication_consent"
  | "delivery_preference"
  | "collect_email"
  | "email_invalid"
  | "confirm"
  | "edit_field_choice"
  | "edit_gender"
  | "edit_age"
  | "edit_body"
  | "edit_title"
  | "edit_response_type"
  | "edit_publication_consent"
  | "edit_delivery_preference"
  | "max_edits_reached"
  | "waiting_admin_approval"
  | "extra_inbox_message_while_waiting"
  | "start_new_process_while_waiting";

export type RenderVars = {
  asker_gender: string;
  asker_age: string;
  title: string;
  content: string;
  response_type: string;
  publication_consent: string;
  delivery_preference: string;
  asker_email?: string | null;
};

type BotTextDef = {
  textByGender: Partial<Record<Gender, string>>;
  buttons?: string[];
};

type BotTextsCache = Record<string, BotTextDef>;

let cache: BotTextsCache | null = null;

function mdPath(): string {
  // Repo root is process.cwd() in Next.js server.
  return path.join(process.cwd(), "WHATSAPP_BOT_TEXTS.md");
}

function normalizeStateKey(headerName: string): string {
  // Example header: "confirm (סיכום מלא + עריכה/אישור)" -> "confirm"
  // Example header: "gender_invalid_first (fallback לקלט לא תקין)" -> "gender_invalid_first"
  const trimmed = headerName.trim();
  // Split by first whitespace or '('.
  const m = trimmed.match(/^([A-Za-z0-9_]+)/);
  return m ? m[1]! : trimmed.split(" ")[0] ?? trimmed;
}

function normalizeLineEndings(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

function trimBlock(s: string): string {
  return s.replace(/\s+$/g, "");
}

function extractBetween(lines: string[], startIdx: number, endPred: (line: string) => boolean): string {
  const out: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]!;
    if (endPred(line)) break;
    out.push(line);
  }
  return out.join("\n");
}

function parseButtons(lines: string[], startIdx: number): string[] {
  // After a line matching **כפתורים or **כפתור, parse "- ..." items until next header or '---'.
  const out: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^---$/.test(line)) break;
    if (/^## State:\s*/.test(line)) break;
    // Stop when we hit the next markdown header starting with '**'
    if (/^\*\*[^-]/.test(line)) break;
    const m = line.match(/^-+\s*(.+)$/);
    if (m) out.push(m[1]!.trim());
  }
  return out;
}

function parseStateSection(stateName: string, section: string): BotTextDef {
  const lines = normalizeLineEndings(section).split("\n");
  let textByGender: Partial<Record<Gender, string>> = {};

  const textMarkerIdx = lines.findIndex((l) => l.trim() === "**טקסט**");
  if (textMarkerIdx === -1) {
    // Some states might omit **טקסט**
    return { textByGender: {} };
  }

  // Find where the text block ends: either **כפתורים / **כפתור OR --- OR another state marker.
  const textBlock = extractBetween(
    lines,
    textMarkerIdx + 1,
    (l) =>
      /^\*\*/.test(l.trim()) ||
      /^---$/.test(l.trim()) ||
      /^## State:\s*/.test(l.trim())
  );

  const blockLines = normalizeLineEndings(textBlock).split("\n");
  // Parse M:/F: blocks if present.
  const mIdx = blockLines.findIndex((l) => l.trim().startsWith("M:"));
  const fIdx = blockLines.findIndex((l) => l.trim().startsWith("F:"));

  if (mIdx !== -1 || fIdx !== -1) {
    // We'll parse by scanning and capturing current gender until we switch.
    let current: Gender | null = null;
    let acc: string[] = [];
    const flush = () => {
      if (!current) return;
      textByGender[current] = trimBlock(acc.join("\n")).trimEnd();
    };
    for (const line of blockLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("M:")) {
        flush();
        current = "M";
        acc = [trimmed.replace(/^M:\s?/, "")];
        continue;
      }
      if (trimmed.startsWith("F:")) {
        flush();
        current = "F";
        acc = [trimmed.replace(/^F:\s?/, "")];
        continue;
      }
      if (current) acc.push(line);
    }
    flush();
  } else {
    // Fallback: same text for both.
    const all = trimBlock(textBlock);
    textByGender = { M: all, F: all };
  }

  // Buttons (optional)
  let buttons: string[] | undefined;
  const buttonsMarkerIdx = lines.findIndex((l) => l.trim().startsWith("**כפתורים") || l.trim().startsWith("**כפתור"));
  if (buttonsMarkerIdx !== -1) {
    buttons = parseButtons(lines, buttonsMarkerIdx + 1);
  }

  return { textByGender, buttons };
}

function parseMd(): BotTextsCache {
  const file = mdPath();
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    // Cache empty; caller will handle missing text.
    return {};
  }

  const text = normalizeLineEndings(raw);
  const lines = text.split("\n");

  const states: BotTextsCache = {};

  // Split by "## State: X"
  const stateHeaderIdxs: Array<{ idx: number; name: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = line.match(/^## State:\s*(.+)$/);
    if (m) {
      stateHeaderIdxs.push({ idx: i, name: normalizeStateKey(m[1]!.trim()) });
    }
  }

  for (let i = 0; i < stateHeaderIdxs.length; i++) {
    const cur = stateHeaderIdxs[i]!;
    const next = stateHeaderIdxs[i + 1];
    const end = next ? next.idx : lines.length;
    const section = lines.slice(cur.idx, end).join("\n");
    // Remove the header line so parseStateSection gets the section content starting from **טקסט**
    const sectionWithoutHeader = section.replace(/^## State:\s*.+\n/, "");
    states[cur.name] = parseStateSection(cur.name, sectionWithoutHeader);
  }

  return states;
}

function getCache(): BotTextsCache {
  if (!cache) cache = parseMd();
  return cache!;
}

function renderConditionalAskerEmail(template: string, vars: RenderVars): string {
  // Supports the specific tag used in the md file:
  // {% if asker_email exists %} ... {% endif %}
  const re = /\{%\s*if\s+asker_email\s+exists\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
  return template.replace(re, (_match, inner: string) => {
    const has = Boolean(vars.asker_email && vars.asker_email.trim());
    return has ? inner : "";
  });
}

function renderPlaceholders(template: string, vars: RenderVars): string {
  return template
    .replace(/\{\{\s*asker_gender\s*\}\}/g, vars.asker_gender)
    .replace(/\{\{\s*asker_age\s*\}\}/g, vars.asker_age)
    .replace(/\{\{\s*title\s*\}\}/g, vars.title)
    .replace(/\{\{\s*content\s*\}\}/g, vars.content)
    .replace(/\{\{\s*response_type\s*\}\}/g, vars.response_type)
    .replace(/\{\{\s*publication_consent\s*\}\}/g, vars.publication_consent)
    .replace(/\{\{\s*delivery_preference\s*\}\}/g, vars.delivery_preference)
    .replace(/\{\{\s*asker_email\s*\}\}/g, vars.asker_email ?? "");
}

export function renderBotText(stateKey: BotTextStateKey | string, gender: Gender, vars: RenderVars): string {
  const defs = getCache();
  const def = defs[stateKey];
  const raw = def?.textByGender?.[gender] ?? def?.textByGender?.M ?? def?.textByGender?.F ?? "";
  if (!raw) return "";

  const withCond = renderConditionalAskerEmail(raw, vars);
  const rendered = renderPlaceholders(withCond, vars);
  return rendered.trimEnd();
}

