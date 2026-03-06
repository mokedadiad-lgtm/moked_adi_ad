import { LoginForm } from "@/components/login/login-form";

export const metadata = {
  title: "כניסת צוות | אסק מי פלוס",
  description: "התחברות למערכת ניהול המוקד",
};

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { error: errorParam, next: nextParam } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4" dir="rtl">
      <div className="w-full max-w-md">
        <LoginForm
          initialError={errorParam === "forbidden" ? "אין לך הרשאה לגשת לדפי הניהול." : undefined}
          nextUrl={nextParam ?? undefined}
        />
      </div>
    </div>
  );
}
