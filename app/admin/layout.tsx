import { AdminShell } from "@/components/admin/admin-shell";
import { canAccessAdminFromServerCookie } from "@/lib/supabase/page-auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const canAccess = await canAccessAdminFromServerCookie();
  if (!canAccess) redirect("/login");
  return <AdminShell>{children}</AdminShell>;
}
