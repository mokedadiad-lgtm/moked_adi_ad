import { ProofreaderDashboard } from "@/components/proofreader/proofreader-dashboard";
import { Suspense } from "react";

export const metadata = {
  title: "לובי הגהה | אסק מי פלוס",
  description: "אזור מגיהים – משימות בהמתנה",
};

export default function ProofreaderPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Suspense fallback={<div className="flex min-h-[12rem] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary" /></div>}>
        <ProofreaderDashboard />
      </Suspense>
    </div>
  );
}
