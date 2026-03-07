/**
 * ייצור PDF מ-HTML באמצעות Puppeteer. העברית והשורות מוצגים נכון.
 */
import { buildPdfHtml } from "./pdf-html-template";

export type PdfHtmlOptions = Parameters<typeof buildPdfHtml>[0];

export async function renderPdfFromHtml(options: PdfHtmlOptions): Promise<Buffer> {
  const puppeteer = await import("puppeteer").catch(() => null);
  if (!puppeteer?.default) {
    throw new Error("puppeteer not installed. Run: npm install puppeteer");
  }

  const html = buildPdfHtml(options);
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 20000,
    });
    // Wait for web fonts (Heebo) to load so PDF text renders correctly
    await page.evaluate(async () => {
      if ("fonts" in document && typeof (document as Document & { fonts: { ready: Promise<void> } }).fonts?.ready?.then === "function") {
        await (document as Document & { fonts: { ready: Promise<void> } }).fonts.ready;
      }
    }).catch(() => {});
    await page.emulateMediaType("print");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
