import { NextRequest, NextResponse } from "next/server";
import { getTeamWhatsappProfiles } from "@/lib/whatsapp/inboxService";
import { requireAdminFromRequest } from "@/lib/supabase/admin-route-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminFromRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const profiles = await getTeamWhatsappProfiles();
    return NextResponse.json({ ok: true, profiles });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

