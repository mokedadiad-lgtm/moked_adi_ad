import { BrandLogo } from "@/components/brand-logo";
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
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <BrandLogo
          priority
          imageClassName="max-w-[80px] sm:max-w-[92px] md:max-w-[100px]"
        />
        <LoginForm />
      </div>
    </div>
  );
}
