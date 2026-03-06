import { AdminShell } from "@/components/admin/admin-shell";

export default function ProofreaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
