import { NextResponse } from "next/server";
import { getTeamWhatsappProfiles } from "@/lib/whatsapp/inboxService";

export async function GET() {
  try {
    const profiles = await getTeamWhatsappProfiles();
    return NextResponse.json({ ok: true, profiles });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

