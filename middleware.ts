import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

const LOGIN_PATH = "/login";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/admin")) {
    return response;
  }

  const supabase = createSupabaseMiddlewareClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin, is_technical_lead")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "אין הרשאה לגשת לדפי הניהול" },
      { status: 403 }
    );
  }

  const isAllowed = profile.is_admin === true || profile.is_technical_lead === true;
  if (!isAllowed) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("error", "forbidden");
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
  ],
};
