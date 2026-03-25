import { RespondentDashboard } from "@/components/respondent/respondent-dashboard";
import { PageLoadingFallback } from "@/components/ui/page-loading";
import { Suspense } from "react";

export const metadata = {
  title: "שולחן עבודה - משיבים | אסק מי פלוס",
  description: "אזור עבודה למשיבים",
};

export default function RespondentPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Suspense fallback={<PageLoadingFallback minHeight="min-h-screen" />}>
        <RespondentDashboard />
      </Suspense>
    </div>
  );
}
