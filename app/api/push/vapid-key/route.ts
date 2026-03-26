import { NextResponse } from "next/server";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push/config";

export async function GET() {
  if (!isPushConfigured()) {
    return NextResponse.json({ publicKey: null, configured: false });
  }
  return NextResponse.json({
    publicKey: getVapidPublicKey(),
    configured: true,
  });
}
