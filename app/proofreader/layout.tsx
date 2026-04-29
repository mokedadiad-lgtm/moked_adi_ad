import { AdminShell } from "@/components/admin/admin-shell";
import { canAccessProofreaderFromServerCookie } from "@/lib/supabase/page-auth";
import { redirect } from "next/navigation";

export default async function ProofreaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const canAccess = await canAccessProofreaderFromServerCookie();
  if (!canAccess) redirect("/login");
  return <AdminShell>{children}</AdminShell>;
}
