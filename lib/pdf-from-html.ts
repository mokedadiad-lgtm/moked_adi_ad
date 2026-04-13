/**
 * ייצור PDF מ-HTML באמצעות Puppeteer. העברית והשורות מוצגים נכון.
 * גופני Heebo מוטמעים כ-base64 ב-HTML כדי שהטקסט ייצא תמיד תקין (ללא תלות ברשת).
 */
import path from "path";
import fs from "fs";
import { getPdfLogoAssets } from "./pdf-brand-assets";
import { buildPdfHtml } from "./pdf-html-template";

const CDN_BASE = "https://cdn.jsdelivr.net/npm/@fontsource/heebo@5.2.8/files";
const FONT_400 = "heebo-hebrew-400-normal.woff";
const FONT_700 = "heebo-hebrew-700-normal.woff";

/** פוטר: קו ורוד 75% רוחב (פס מלא — לא border על div ריק) */
const PDF_FOOTER_TEMPLATE = `
<div style="width:100%;box-sizing:border-box;background:#FAF7F9!important;font-family:system-ui,'Segoe UI',sans-serif;direction:rtl;padding:0 28px 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
  <div style="width:75%;max-width:75%;height:2px;margin:0 auto;background:#E8B4C8;border-radius:1px;"></div>
  <div style="font-size:8px;line-height:1.45;color:#5C5C78;text-align:center;padding-top:6px;background:#FAF7F9;">
    <div style="font-weight:700;color:#2C2C54;">אסק מי פלוס – מענה אנונימי מטעם ארגון &quot;עדי עד&quot;</div>
    <div style="color:#AD1457;margin-top:3px;">אתר עדי עד: www.adeyad.org</div>
    <div style="margin-top:3px;">המידע בתשובה זו הינו כללי ואינו מהווה תחליף לייעוץ מקצועי אישי.</div>
  </div>
</div>
`.trim();

export type PdfHtmlOptions = Parameters<typeof buildPdfHtml>[0];

/** מחזיר CSS של @font-face עם גופני Heebo כ-base64 (מקבצים מקומיים או CDN) */
async function getHeeboFontFaceCss(): Promise<string> {
  const cwd = process.cwd();
  const publicDir = path.join(cwd, "public", "fonts");
  const dest400 = path.join(publicDir, FONT_400);
  const dest700 = path.join(publicDir, FONT_700);

  let base64_400: string;
  let base64_700: string;

  if (fs.existsSync(dest400) && fs.existsSync(dest700)) {
    base64_400 = fs.readFileSync(dest400, "base64");
    base64_700 = fs.readFileSync(dest700, "base64");
  } else {
    const [res400, res700] = await Promise.all([
      fetch(`${CDN_BASE}/${FONT_400}`),
      fetch(`${CDN_BASE}/${FONT_700}`),
    ]);
    if (!res400.ok || !res700.ok) return "";
    const [buf400, buf700] = await Promise.all([
      res400.arrayBuffer(),
      res700.arrayBuffer(),
    ]);
    base64_400 = Buffer.from(buf400).toString("base64");
    base64_700 = Buffer.from(buf700).toString("base64");
  }

  return `
@font-face {
  font-family: 'Heebo';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(data:font/woff;base64,${base64_400}) format('woff');
}
@font-face {
  font-family: 'Heebo';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(data:font/woff;base64,${base64_700}) format('woff');
}
`;
}

export async function renderPdfFromHtml(options: PdfHtmlOptions): Promise<Buffer> {
  const isVercel = process.env.VERCEL === "1";
  const fontFaceCss = await getHeeboFontFaceCss().catch(() => undefined);
  const logoAssets = getPdfLogoAssets();
  const html = buildPdfHtml({ ...options, fontFaceCss, ...logoAssets });

  interface BrowserLike {
    newPage(): Promise<{
      setContent(html: string, opts?: object): Promise<void>;
      evaluate(fn: () => Promise<void>): Promise<void>;
      emulateMediaType(type: string): Promise<void>;
      pdf(opts: object): Promise<Buffer | Uint8Array>;
    }>;
    close(): Promise<void>;
  }
  let browser: BrowserLike;
  if (isVercel) {
    const chromium = await import("@sparticuz/chromium").catch(() => null);
    const puppeteerCore = await import("puppeteer-core").catch(() => null);
    if (!chromium?.default || !puppeteerCore?.default) {
      throw new Error(
        "On Vercel, @sparticuz/chromium and puppeteer-core are required for PDF. Install: npm install @sparticuz/chromium puppeteer-core"
      );
    }
    browser = (await puppeteerCore.default.launch({
      args: [...chromium.default.args, "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: await chromium.default.executablePath(),
      headless: true,
    })) as BrowserLike;
  } else {
    const puppeteer = await import("puppeteer").catch(() => null);
    if (!puppeteer?.default) {
      throw new Error("puppeteer not installed. Run: npm install puppeteer");
    }
    browser = (await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })) as BrowserLike;
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: fontFaceCss ? "domcontentloaded" : "networkidle0",
      timeout: 20000,
    });
    if (!fontFaceCss) {
      await page.evaluate(async () => {
        if ("fonts" in document && typeof (document as Document & { fonts: { ready: Promise<void> } }).fonts?.ready?.then === "function") {
          await (document as Document & { fonts: { ready: Promise<void> } }).fonts.ready;
        }
      }).catch(() => {});
    } else {
      await page.evaluate(async () => {
        await (document as Document & { fonts: { ready: Promise<void> } }).fonts?.ready;
      }).catch(() => {});
    }
    await page.emulateMediaType("print");
    /** שוליים מ־@page ב־pdf-html-template (עמוד ראשון / 2 ס"מ למעלה מעמוד 2, תחתית לפוטר). לא לשכפל margin תחתון כאן. */
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      displayHeaderFooter: true,
      headerTemplate: '<div style="height:0;margin:0;padding:0;font-size:0;"></div>',
      footerTemplate: PDF_FOOTER_TEMPLATE,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
