import fs from "fs";
import path from "path";

/** לוגו מוטמע ל-PDF (Puppeteer / react-pdf) ללא תלות ברשת */
export function getPdfLogoDataUri(): string | undefined {
  const p = path.join(process.cwd(), "public", "brand", "logo-full.png");
  if (!fs.existsSync(p)) return undefined;
  return `data:image/png;base64,${fs.readFileSync(p, "base64")}`;
}
