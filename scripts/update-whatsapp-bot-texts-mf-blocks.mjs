import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "WHATSAPP_BOT_TEXTS.md");

const raw = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
const lines = raw.split("\n");

function transformForFemale(line) {
  // Minimal set of gender substitutions to make the sample texts gendered.
  // (Full grammar may be handled later by editing the MD manually.)
  return line
    .replace(/\bאתה\b/g, "את")
    .replace(/\bמעוניין\b/g, "מעוניינת");
}

const out = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];
  if (line.trim() === "**טקסט**") {
    // Determine the end of this **טקסט** block.
    const start = i + 1;
    let end = start;
    for (; end < lines.length; end++) {
      const t = lines[end].trim();
      if (t.startsWith("**כפתורים") || t.startsWith("**כפתור") || t === "---" || t.startsWith("## State:")) {
        break;
      }
    }

    const blockLines = lines.slice(start, end);
    const alreadyHasMf = blockLines.some((l) => l.trim().startsWith("M:") || l.trim().startsWith("F:"));

    if (alreadyHasMf) {
      out.push(line);
      out.push(...blockLines);
      i = end;
      continue;
    }

    if (blockLines.length === 0) {
      out.push(line);
      out.push("M: ");
      out.push("F: ");
      i = end;
      continue;
    }

    // Prefix only the first line with M:/F:, keep the remaining lines as-is for that gender.
    const mLines = [`M: ${blockLines[0]}` , ...blockLines.slice(1)];
    const fLines = [`F: ${transformForFemale(blockLines[0])}` , ...blockLines.slice(1).map(transformForFemale)];

    out.push(line);
    out.push(...mLines);
    out.push(...fLines);

    i = end;
    continue;
  }

  out.push(line);
  i++;
}

const updated = out.join("\n");
fs.writeFileSync(filePath, updated, "utf8");
console.log("Updated WHATSAPP_BOT_TEXTS.md with M:/F: blocks (where missing).");

