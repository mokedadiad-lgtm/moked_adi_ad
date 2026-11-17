import { LandingForm } from "@/components/landing-form";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-20">
        <LandingForm />
      </div>
    </main>
  );
}
