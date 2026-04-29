import { AdminShell } from "@/components/admin/admin-shell";
import { canAccessRespondentFromServerCookie } from "@/lib/supabase/page-auth";
import { redirect } from "next/navigation";

export default async function RespondentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const canAccess = await canAccessRespondentFromServerCookie();
  if (!canAccess) redirect("/login");
  return <AdminShell>{children}</AdminShell>;
}
