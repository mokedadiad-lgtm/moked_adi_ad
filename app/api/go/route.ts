import { NextRequest, NextResponse } from "next/server";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/**
 * Redirect למסלול באתר. משמש קישורים ממייל – לפעמים נפתח כשקישור ישיר נחסם.
 * רק מסלולים יחסיים (מתחיל ב-/ בלי //) – מניעת open redirect.
 */
export function GET(request: NextRequest) {
  const r = request.nextUrl.searchParams.get("r");
  if (!r || typeof r !== "string") {
    return NextResponse.redirect(APP_URL, 302);
  }
  const decoded = decodeURIComponent(r);
  if (!decoded.startsWith("/") || decoded.includes("//")) {
    return NextResponse.redirect(APP_URL, 302);
  }
  const target = `${APP_URL}${decoded}`;
  return NextResponse.redirect(target, 302);
}
