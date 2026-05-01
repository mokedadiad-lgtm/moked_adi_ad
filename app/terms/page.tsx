export default function TermsPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 py-16">
      <div className="mx-auto w-full max-w-4xl px-6">
        <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <header className="mb-10 border-b border-slate-200 pb-6">
            <p className="text-sm font-medium text-slate-500">עודכן לאחרונה: מאי 2026</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              תנאי שימוש
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-700">
              תנאים אלה מסדירים את השימוש במערכת הניהול הארגונית של עדי עד / Adey Ad על ידי אנשי צוות, רכזים
              וגורמים מורשים נוספים.
            </p>
          </header>

          <div className="space-y-8 text-slate-800">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">1. שימוש מותר במערכת</h2>
              <p className="leading-7">
                השימוש במערכת מיועד לניהול פעילות ארגונית בלבד, לרבות תיאום משימות, מעקב אחר תהליכים ותקשורת
                מקצועית בין גורמי הצוות.
              </p>
              <p className="leading-7">
                חל איסור לעשות שימוש במערכת לצרכים פרטיים, לפעילות בלתי חוקית, להפצת תוכן פוגעני, או לכל פעולה
                העלולה לפגוע בארגון, במשתתפים או במשתמשים אחרים.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">2. סודיות ושמירה על מידע משתתפים</h2>
              <p className="leading-7">
                אנשי הצוות והרכזים מתחייבים לשמור בסודיות מלאה על מידע הנוגע למשתתפים, פניות, ומידע אישי הנחשף להם
                במסגרת עבודתם במערכת.
              </p>
              <p className="leading-7">
                אין להעביר מידע זה לצדדים שלישיים ללא הרשאה מתאימה או חובה חוקית, ויש לפעול לפי נהלי הארגון והדין
                החל.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">3. אחריות משתמש</h2>
              <p className="leading-7">
                המשתמש אחראי לשמירת פרטי הגישה שלו, לשימוש זהיר בהרשאות שניתנו לו, ולדיווח מיידי על חשד לשימוש בלתי
                מורשה בחשבון.
              </p>
              <p className="leading-7">
                הנהלת המערכת רשאית להגביל או להשעות גישה במקרה של שימוש החורג מהוראות תנאים אלה או מכללי הארגון.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">4. הגבלת אחריות</h2>
              <p className="leading-7">
                המערכת ניתנת לשימוש כפי שהיא (As-Is). הארגון אינו מתחייב לזמינות רציפה ללא תקלות, ואינו אחראי לכל
                נזק עקיף, תוצאתי או אובדן נתונים שייגרם עקב שימוש במערכת, ככל שהדבר מותר לפי דין.
              </p>
              <p className="leading-7">
                הארגון יפעל באופן סביר לתחזוקה שוטפת, שיפור ביצועים וטיפול בתקלות מערכתיות.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">5. שינויים בתנאים</h2>
              <p className="leading-7">
                הנהלת עדי עד / Adey Ad רשאית לעדכן תנאי שימוש אלה מעת לעת. מועד העדכון האחרון יופיע בראש עמוד זה.
                המשך השימוש במערכת לאחר עדכון מהווה הסכמה לתנאים המעודכנים.
              </p>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
