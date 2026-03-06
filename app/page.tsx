import { LandingForm } from "@/components/landing-form";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50/50">
      <header className="pt-10 pb-6 text-start">
        <p className="text-xl font-semibold tracking-tight text-primary md:text-2xl">
          עדי עד – מקום בטוח ללב שלך
        </p>
      </header>

      <div className="mx-auto max-w-2xl px-4 pb-20">
        <section className="mb-5 rounded-xl border border-slate-200/80 bg-white p-4 text-start shadow-sm">
          <p className="mb-1.5 text-sm font-semibold text-slate-700">
            ברוכה הבאה למוקד האסק-מי פלוס.
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            כאן ניתן להשאיר את השאלה שלך ואנו נשתדל לענות עליה בעז&quot;ה. נא לענות על השאלות הבאות ולאשר את התקנון.
          </p>
        </section>

        <section className="mb-6 rounded-xl border border-slate-200/80 bg-white p-4 text-start shadow-sm">
          <h2 className="mb-2 flex items-center justify-start gap-1.5 text-sm font-semibold text-primary">
            <span>🔒</span> דיסקרטיות מלאה
          </h2>
          <p className="text-xs leading-relaxed text-slate-600">
            הכל נשאר חסוי ואנונימי. אנו מתחייבים לשמור על דיסקרטיות מלאה, ולכן גם
            אם יש פרטים שידועים לנו על הפונה, הם חסויים וישארו כך. למעט מקרים בהם
            מתקיים נוהל חירום והצלת חיים, שבהם אנו מחויבים על פי חוק ומוסריות לעשות כל מאמץ להציל חיים.
          </p>
        </section>

        <LandingForm />
      </div>
    </main>
  );
}
