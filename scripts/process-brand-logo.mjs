/**
 * חיתוך שוליים (trim), המרת שחור/מסגרת כחולה בהירה לשקיפות, שמירה ל-public/brand/logo-full.png
 * שימוש: node scripts/process-brand-logo.mjs [קלט.png]
 * ברירת מחדל לקלט: public/brand/logo-full.png (דורס אחרי עיבוד)
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicBrand = path.join(__dirname, "..", "public", "brand");
const defaultInput = path.join(publicBrand, "logo-full.png");
const outputPath = path.join(publicBrand, "logo-full.png");

/** פיקסל "שחור רקע" */
const BLACK_MAX = 38;
/** מסגרת כחולה בהירה (פינות/מסביב) */
function isLightBlueBorder(r, g, b) {
  return b > 205 && r > 155 && g > 175 && b - r > 20 && b - g > 10;
}

async function main() {
  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultInput;
  if (!fs.existsSync(inputPath)) {
    console.error("Input not found:", inputPath);
    process.exit(1);
  }
  const buf = await fs.promises.readFile(inputPath);

  const trimmed = await sharp(buf).ensureAlpha().trim({ threshold: 18 }).png().toBuffer();

  const { data, info } = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  if (channels !== 4) {
    throw new Error(`Expected 4 channels (RGBA), got ${channels}`);
  }

  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (r <= BLACK_MAX && g <= BLACK_MAX && b <= BLACK_MAX) {
      out[i + 3] = 0;
    } else if (isLightBlueBorder(r, g, b)) {
      out[i + 3] = 0;
    }
  }

  await fs.promises.mkdir(publicBrand, { recursive: true });
  await sharp(out, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toFile(outputPath);

  console.log("Wrote", outputPath, `${info.width}x${info.height}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
