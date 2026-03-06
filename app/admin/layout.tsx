import { AdminNav } from "@/components/admin/admin-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background" dir="rtl">
      <aside className="fixed start-0 top-0 z-20 flex h-full w-56 flex-col border-e border-slate-700/80 bg-slate-800 shadow-xl">
        <div className="border-b border-slate-600/60 p-5 text-start">
          <h2 className="text-lg font-bold text-white">
            אסק מי פלוס
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">ממשק מנהל</p>
        </div>
        <AdminNav />
      </aside>
      <main className="min-h-screen flex-1 min-w-0 pt-6 pb-8 ps-[17rem] pe-8">
        <div className="mx-auto w-full max-w-6xl px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
