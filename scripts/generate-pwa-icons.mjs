import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const svgPath = path.join(publicDir, "icon.svg");

const sizes = [192, 512];

const svg = fs.readFileSync(svgPath);
for (const size of sizes) {
  const outPath = path.join(publicDir, `icon-${size}.png`);
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`Created ${outPath}`);
}
