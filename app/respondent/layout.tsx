import { AdminShell } from "@/components/admin/admin-shell";

export default function RespondentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
