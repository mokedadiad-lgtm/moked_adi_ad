import { LoginForm } from "@/components/login/login-form";

export const metadata = {
  title: "כניסת צוות | אסק מי פלוס",
  description: "התחברות למערכת ניהול המוקד",
};

export default function LoginPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-start bg-background p-4 pt-6 md:justify-center"
      dir="rtl"
    >
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}
