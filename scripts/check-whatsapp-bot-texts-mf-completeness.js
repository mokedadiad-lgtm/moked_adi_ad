import fs from "fs";
import path from "path";

const mdPath = path.join(process.cwd(), "WHATSAPP_BOT_TEXTS.md");
const raw = fs.readFileSync(mdPath, "utf8").replace(/\r\n/g, "\n");
const lines = raw.split("\n");

function normalizeStateKey(headerName) {
  const trimmed = headerName.trim();
  const m = trimmed.match(/^([A-Za-z0-9_]+)/);
  return m ? m[1] : trimmed.split(" ")[0];
}

const stateHeaders = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/^## State:\s*(.+)$/);
  if (m) stateHeaders.push({ idx: i, name: normalizeStateKey(m[1]) });
}

const expectedStateKeys = [
  "start",
  "gender_invalid_first",
  "choose_mode",
  "human_handoff",
  "age",
  "age_invalid_first",
  "age_invalid_second",
  "body_collect",
  "body_invalid_or_empty",
  "title_collect",
  "response_type",
  "publication_consent",
  "delivery_preference",
  "collect_email",
  "email_invalid",
  "confirm",
  "edit_gender",
  "edit_age",
  "edit_body",
  "edit_title",
  "edit_response_type",
  "edit_publication_consent",
  "edit_delivery_preference",
  "max_edits_reached",
  "waiting_admin_approval",
  "extra_inbox_message_while_waiting",
  "start_new_process_while_waiting",
];

const sections = new Map();
for (let i = 0; i < stateHeaders.length; i++) {
  const cur = stateHeaders[i];
  const next = stateHeaders[i + 1];
  const end = next ? next.idx : lines.length;
  sections.set(cur.name, lines.slice(cur.idx, end).join("\n"));
}

function extractTextBlock(section) {
  const secLines = section.split("\n");
  const textIdx = secLines.findIndex((l) => l.trim() === "**טקסט**");
  if (textIdx === -1) return null;
  let end = secLines.length;
  for (let j = textIdx + 1; j < secLines.length; j++) {
    const t = secLines[j].trim();
    if (t.startsWith("**כפתורים") || t.startsWith("**כפתור") || t === "---") {
      end = j;
      break;
    }
  }
  return secLines.slice(textIdx + 1, end);
}

const missing = [];
const noMF = [];

for (const key of expectedStateKeys) {
  const sec = sections.get(key);
  if (!sec) {
    missing.push(key);
    continue;
  }
  const tb = extractTextBlock(sec);
  if (!tb) {
    missing.push(key + " (no **טקסט**)");
    continue;
  }
  const hasM = tb.some((l) => l.trim().startsWith("M:"));
  const hasF = tb.some((l) => l.trim().startsWith("F:"));
  if (!hasM || !hasF) {
    noMF.push(key);
  }
}

if (missing.length || noMF.length) {
  console.log("Missing/invalid states:", missing);
  console.log("Missing M or F in:", noMF);
  process.exit(1);
}

console.log("OK: All expected states have M and F blocks for **טקסט**");

