import { ProofreaderDashboard } from "@/components/proofreader/proofreader-dashboard";
import { PageLoadingFallback } from "@/components/ui/page-loading";
import { Suspense } from "react";

export const metadata = {
  title: "לובי הגהה | אסק מי פלוס",
  description: "אזור מגיהים – משימות בהמתנה",
};

export default function ProofreaderPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Suspense fallback={<PageLoadingFallback />}>
        <ProofreaderDashboard />
      </Suspense>
    </div>
  );
}
