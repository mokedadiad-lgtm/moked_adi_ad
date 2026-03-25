/**
 * יוצר icon-192.png, icon-512.png ומעתיק ל-app/icon.png:
 * רקע בהיר, לוגו ממורכז, טקסט "אסק מי פלוס" בתחתית.
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
const TEXT_FILL = "#1a1a35";

async function buildIcon(size) {
  if (!fs.existsSync(logoPath)) {
    throw new Error(`Logo not found: ${logoPath}`);
  }

  const textBand = Math.round(size * 0.24);
  const verticalPadding = Math.round(size * 0.06);
  const logoMaxHeight = size - textBand - verticalPadding * 2;

  const logoBuf = await sharp(logoPath)
    .resize({
      height: logoMaxHeight,
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
  const logoTop = verticalPadding;

  const fontSize = Math.max(11, Math.round(size * 0.052));
  const textSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${textBand}">
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" direction="rtl"
    font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="600"
    fill="${TEXT_FILL}">אסק מי פלוס</text>
</svg>`;

  const textBuf = await sharp(Buffer.from(textSvg)).png().toBuffer();
  const textTop = size - textBand;

  const outPath = path.join(publicDir, `icon-${size}.png`);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([
      { input: logoBuf, top: logoTop, left: logoLeft },
      { input: textBuf, top: textTop, left: 0 },
    ])
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
