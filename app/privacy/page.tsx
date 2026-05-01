export default function PrivacyPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 py-16">
      <div className="mx-auto w-full max-w-4xl px-6">
        <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <header className="mb-10 border-b border-slate-200 pb-6">
            <p className="text-sm font-medium text-slate-500">עודכן לאחרונה: מאי 2026</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              מדיניות פרטיות
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-700">
              מדיניות זו מתארת כיצד מערכת הניהול הארגונית של עדי עד / Adey Ad אוספת, משתמשת ושומרת מידע,
              לצורך ניהול פעילות, משימות ותקשורת פנים-ארגונית.
            </p>
          </header>

          <div className="space-y-8 text-slate-800">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">1. איסוף מידע</h2>
              <p className="leading-7">
                המערכת אוספת מידע הנדרש לתפעול שוטף, לרבות פרופילי משתמשים, פרטי הרשאות, שיוך תפקידים, וניהול
                משימות ותהליכי עבודה בתוך הארגון.
              </p>
              <p className="leading-7">
                מידע זה נמסר על ידי משתמשי המערכת או מוזן על ידי צוות מורשה לצורך פעילות ארגונית תקינה.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">2. אינטגרציה עם WhatsApp Business API</h2>
              <p className="leading-7">
                המערכת עשויה להשתמש באינטגרציה עם WhatsApp Business API לצורך שליחת וקבלת הודעות תפעוליות.
              </p>
              <p className="leading-7">
                הודעות אלה עשויות לכלול מידע הקשור לניהול פניות, עדכונים לצוותים ותקשורת שירות. השימוש באינטגרציה
                כפוף גם לתנאי השימוש ומדיניות הפרטיות של WhatsApp ו-Meta.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">3. אבטחת מידע ואחסון</h2>
              <p className="leading-7">
                הנתונים נשמרים בתשתית Supabase תוך שימוש במנגנוני אבטחה מקובלים בתעשייה, לרבות בקרות גישה, הפרדת
                הרשאות ותיעוד פעולות מערכת.
              </p>
              <p className="leading-7">
                הארגון פועל לצמצום סיכוני אבטחה, אך אין אפשרות להבטיח חסינות מוחלטת מפני אירועי סייבר או חדירה
                בלתי מורשית.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">4. זכות לעיון, תיקון ומחיקה</h2>
              <p className="leading-7">
                למשתמשים עומדת הזכות לפנות בבקשה לעיון במידע אישי, לעדכון פרטים שגויים, או לבקשת מחיקת מידע, בכפוף
                לדרישות דין ולצרכים תפעוליים מחייבים של הארגון.
              </p>
              <p className="leading-7">
                בקשות בנושא פרטיות ומחיקת מידע ייבחנו באופן פרטני ויטופלו בזמן סביר.
              </p>
            </section>

            <section id="deletion" className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
              <h2 className="text-xl font-semibold text-slate-900">בקשה למחיקת נתונים</h2>
              <p className="leading-7">
                משתמשים יכולים לבקש מחיקה של הנתונים האישיים שלהם (מידע פרופיל, היסטוריית משימות) בכל עת.
              </p>
              <p className="leading-7">
                לצורך הגשת בקשת מחיקה, יש לשלוח הודעת דוא&quot;ל לכתובת:{" "}
                <a
                  href="mailto:mokedadiad@gmail.com"
                  className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-800"
                >
                  mokedadiad@gmail.com
                </a>
                .
              </p>
              <p className="leading-7">
                הבקשה תטופל בתוך 30 ימי עסקים, ולאחר השלמת התהליך תישלח הודעת אישור על מחיקה קבועה של הנתונים ממסד
                הנתונים שלנו ב-Supabase.
              </p>
              <p className="leading-7">
                ייתכן שחלק מהמידע האדמיניסטרטיבי יישמר לצורכי עמידה בדרישות חוק וציות ארגוני, ככל שהדבר נדרש.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">5. יצירת קשר</h2>
              <p className="leading-7">
                לשאלות בנושא פרטיות, שימוש במידע או מימוש זכויות, ניתן לפנות לצוות המערכת של עדי עד / Adey Ad
                בערוצי הקשר הארגוניים המקובלים.
              </p>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
