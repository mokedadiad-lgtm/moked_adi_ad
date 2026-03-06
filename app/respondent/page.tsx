import { RespondentDashboard } from "@/components/respondent/respondent-dashboard";

export const metadata = {
  title: "שולחן עבודה - משיבים | אסק מי פלוס",
  description: "אזור עבודה למשיבים",
};

export default function RespondentPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <RespondentDashboard />
    </div>
  );
}
