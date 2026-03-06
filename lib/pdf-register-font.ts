import path from "path";
import fs from "fs";
import { Font } from "@react-pdf/renderer";

const CDN_BASE = "https://cdn.jsdelivr.net/npm/@fontsource/heebo@5.2.8/files";
const FONT_400 = "heebo-hebrew-400-normal.woff";
const FONT_700 = "heebo-hebrew-700-normal.woff";

let registered = false;

/**
 * מוריד את גופני Heebo ל־public/fonts אם חסרים (למניעת בעיות טעינה מ-CDN ב-Node).
 * קורא לפני registerHeeboFont() ב-API.
 */
export async function ensureHeeboFontFiles(): Promise<void> {
  const cwd = process.cwd();
  const publicDir = path.join(cwd, "public", "fonts");
  const dest400 = path.join(publicDir, FONT_400);
  const dest700 = path.join(publicDir, FONT_700);
  if (fs.existsSync(dest400) && fs.existsSync(dest700)) return;

  try {
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    const [res400, res700] = await Promise.all([
      fetch(`${CDN_BASE}/${FONT_400}`),
      fetch(`${CDN_BASE}/${FONT_700}`),
    ]);
    if (res400.ok && res700.ok) {
      const [buf400, buf700] = await Promise.all([res400.arrayBuffer(), res700.arrayBuffer()]);
      fs.writeFileSync(dest400, Buffer.from(buf400));
      fs.writeFileSync(dest700, Buffer.from(buf700));
    }
  } catch {
    // נשאר על רישום מ-URL
  }
}

/**
 * רישום גופן Heebo לעברית. קורא לפעם אחת לפני רינדור PDF.
 * מחפש ב־node_modules/@fontsource/heebo או ב־public/fonts; אחרת מ-CDN.
 */
export function registerHeeboFont(): void {
  if (registered) return;

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "node_modules", "@fontsource", "heebo", "files", FONT_400),
    path.join(cwd, "node_modules", "@fontsource", "heebo", "files", FONT_700),
    path.join(cwd, "public", "fonts", FONT_400),
    path.join(cwd, "public", "fonts", FONT_700),
  ];

  const font400 = candidates[0];
  const font700 = candidates[1];
  const alt400 = candidates[2];
  const alt700 = candidates[3];

  if (fs.existsSync(font400) && fs.existsSync(font700)) {
    Font.register({
      family: "Heebo",
      fonts: [
        { src: font400, fontWeight: 400 },
        { src: font700, fontWeight: 700 },
      ],
    });
    registered = true;
    return;
  }
  if (fs.existsSync(alt400) && fs.existsSync(alt700)) {
    Font.register({
      family: "Heebo",
      fonts: [
        { src: alt400, fontWeight: 400 },
        { src: alt700, fontWeight: 700 },
      ],
    });
    registered = true;
    return;
  }

  Font.register({
    family: "Heebo",
    fonts: [
      { src: `${CDN_BASE}/${FONT_400}`, fontWeight: 400 },
      { src: `${CDN_BASE}/${FONT_700}`, fontWeight: 700 },
    ],
  });
  registered = true;
}
