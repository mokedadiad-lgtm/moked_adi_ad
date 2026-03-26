/**
 * יוצר icon-192.png, icon-512.png ומעתיק ל-app/icon.png:
 * רקע בהיר ולוגו ממורכז בלבד (ללא טקסט).
 * שימוש: npm run generate-pwa-icons
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const logoPath = path.join(publicDir, "brand", "logo-full.png");

const BG = { r: 250, g: 247, b: 249, alpha: 1 };

async function buildIcon(size) {
  if (!fs.existsSync(logoPath)) {
    throw new Error(`Logo not found: ${logoPath}`);
  }

  const padding = Math.round(size * 0.1);
  const inner = size - padding * 2;

  const logoBuf = await sharp(logoPath)
    .resize({
      width: inner,
      height: inner,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  const meta = await sharp(logoBuf).metadata();
  const lw = meta.width ?? 0;
  const lh = meta.height ?? 0;
  const logoLeft = Math.round((size - lw) / 2);
  const logoTop = Math.round((size - lh) / 2);

  const outPath = path.join(publicDir, `icon-${size}.png`);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logoBuf, top: logoTop, left: logoLeft }])
    .png()
    .toFile(outPath);

  console.log("Wrote", outPath, `(${size}×${size})`);
}

for (const size of [192, 512]) {
  await buildIcon(size);
}

const appIconPath = path.join(__dirname, "..", "app", "icon.png");
await fs.promises.copyFile(path.join(publicDir, "icon-512.png"), appIconPath);
console.log("Copied to app/icon.png");
