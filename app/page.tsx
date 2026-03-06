import { LandingForm } from "@/components/landing-form";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-2xl px-4 pt-10 pb-20">
        <LandingForm />
      </div>
    </main>
  );
}
