import { RespondentDashboard } from "@/components/respondent/respondent-dashboard";
import { Suspense } from "react";

export const metadata = {
  title: "שולחן עבודה - משיבים | אסק מי פלוס",
  description: "אזור עבודה למשיבים",
};

export default function RespondentPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">טוען…</div>}>
        <RespondentDashboard />
      </Suspense>
    </div>
  );
}
