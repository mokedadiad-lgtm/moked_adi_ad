import { ProofreaderDashboard } from "@/components/proofreader/proofreader-dashboard";

export const metadata = {
  title: "לובי הגהה | אסק מי פלוס",
  description: "אזור מגיהים – משימות בהמתנה",
};

export default function ProofreaderPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <ProofreaderDashboard />
    </div>
  );
}
