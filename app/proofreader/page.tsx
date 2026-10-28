import { ProofreaderDashboard } from "@/components/proofreader/proofreader-dashboard";
import { PageLoadingFallback } from "@/components/ui/page-loading";
import { Suspense } from "react";

export const metadata = {
  title: 'לובי הגהה | פשו"ת שידוך',
  description: "אזור מגיהים – משימות בהמתנה",
};

export default function ProofreaderPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Suspense fallback={<PageLoadingFallback minHeight="min-h-screen" />}>
        <ProofreaderDashboard />
      </Suspense>
    </div>
  );
}
