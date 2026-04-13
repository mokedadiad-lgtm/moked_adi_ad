import fs from "fs";
import path from "path";

export interface PdfLogoAssets {
  leftLogoDataUri?: string;
  centerLogoDataUri?: string;
  rightLogoDataUri?: string;
}

function asDataUriIfExists(absPath: string): string | undefined {
  if (!fs.existsSync(absPath)) return undefined;
  return `data:image/png;base64,${fs.readFileSync(absPath, "base64")}`;
}

/** לוגואים מוטמעים ל-PDF (Puppeteer / react-pdf) ללא תלות ברשת */
export function getPdfLogoAssets(): PdfLogoAssets {
  const brandDir = path.join(process.cwd(), "public", "brand");
  return {
    leftLogoDataUri: asDataUriIfExists(path.join(brandDir, "logo-right-adiad.png")),
    centerLogoDataUri: asDataUriIfExists(path.join(brandDir, "logo-full.png")),
    rightLogoDataUri: asDataUriIfExists(path.join(brandDir, "logo-left-bracha.png")),
  };
}
