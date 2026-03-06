import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/** קורא לריענון cache של דף (למשל אחרי שליחת תשובה על ידי משיב). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const path = typeof body.path === "string" ? body.path : "/admin";
    if (path.startsWith("/")) {
      revalidatePath(path);
    }
    return NextResponse.json({ revalidated: true, path });
  } catch {
    return NextResponse.json({ revalidated: false }, { status: 500 });
  }
}
