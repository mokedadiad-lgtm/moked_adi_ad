import { getCategories, getProofreaderTypes, getTopicsWithSubTopics } from "@/app/admin/actions";
import { JoinTeamForm } from "@/components/join-team/join-team-form";
import Image from "next/image";
import { notFound } from "next/navigation";

export const metadata = {
  title: "הצטרפות לצוות | אסק מי פלוס",
  description: "טופס הצטרפות למוקד",
};

export default async function JoinTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { kind: raw } = await params;
  if (raw !== "respondent" && raw !== "proofreader") notFound();
  const kind = raw as "respondent" | "proofreader";
  const { t } = await searchParams;

  const [topics, categories, proofreaderTypes] = await Promise.all([
    getTopicsWithSubTopics(),
    getCategories(),
    getProofreaderTypes(),
  ]);

  return (
    <div className="min-h-screen bg-background px-3 py-6 sm:px-4" dir="rtl">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image src="/brand/logo-full.png" alt="אסק מי פלוס" width={96} height={96} priority className="h-24 w-auto object-contain" />
          <h1 className="text-xl font-bold text-slate-800">
            {kind === "respondent" ? "הצטרפות כמשיב/ה" : "הצטרפות כמגיה/ה"}
          </h1>
          <p className="text-sm text-slate-600">לאחר השליחה הבקשה תועבר לאישור מנהל המערכת.</p>
        </div>
        <JoinTeamForm
          kind={kind}
          initialToken={typeof t === "string" ? t : ""}
          topics={topics}
          categories={categories}
          proofreaderTypes={proofreaderTypes}
        />
      </div>
    </div>
  );
}
