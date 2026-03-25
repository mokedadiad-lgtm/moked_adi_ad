# העלאת האפליקציה לפרודקשן – אסק מי פלוס

מדריך קצר להפיכת האפליקציה לנגישה למשתמשים נוספים.

---

## 1. איפה להעלות (Hosting)

**מומלץ: Vercel** – מתאים ל־Next.js, חינמי ל־hobby, וחיבור ל־Git.

- היכנס ל־[vercel.com](https://vercel.com) וחבר את ריפו ה־Git.
- בחר את הפרויקט `adi-ad` והעלה.
- Vercel יבנה ויעלה אוטומטית. תקבל כתובת כמו: `https://adi-ad-xxx.vercel.app`.

**חלופות:** Railway, Render, או שרת משלך (Node + `npm run build && npm run start`).

---

## 2. משתני סביבה (Environment Variables)

ב־Vercel: **Project → Settings → Environment Variables**. הוסף את כל המשתנים הבאים ל־**Production** (ול־Preview אם תרצה):

| משתנה | חובה | תיאור |
|--------|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | כתובת הפרויקט ב־Supabase (לדוגמה `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | מפתח Anon מ־Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | מפתח Service Role מ־Supabase (שמור בסוד!) |
| `RESEND_API_KEY` | ✅ | מפתח API מ־[Resend](https://resend.com) לשליחת מיילים |
| `NEXT_PUBLIC_APP_URL` | ✅ | כתובת האתר בפרודקשן, למשל `https://your-app.vercel.app` – **חשוב** לקישורים במיילים (שיבוץ משיב, איפוס סיסמה וכו') |
| `RESEND_FROM_EMAIL` | אופציונלי | כתובת השולח, למשל `מערכת <noreply@yourdomain.com>` (אחרת משתמשים ב־onboarding@resend.dev) |
| `CRON_SECRET` | מומלץ | מחרוזת אקראית סודית להפעלת ה־cron (תזכורות וסיכום לובי). יוצרים ב־Vercel ומעבירים ב־Authorization: Bearer |
| `GREEN_API_ID_INSTANCE` | אופציונלי | ל־Green-API (הודעות וואטסאפ) – **legacy**; לפרודקשן מומלץ Meta למטה |
| `GREEN_API_TOKEN_INSTANCE` | אופציונלי | טוקן Green-API |

### וואטסאפ – Meta Cloud API (בוט + שליחה יוצאת)

נדרש ל־webhook ב־`/api/whatsapp/webhook`, לשליחת הודעות מהבוט ולשליחת התראות לצוות/שואל לפי `communication_preference` / `asker_delivery_preference`.

| משתנה | חובה | תיאור |
|--------|------|--------|
| `META_ACCESS_TOKEN` | לשליחה | Access Token של האפליקציה / System User (עם `whatsapp_business_messaging`) |
| `META_PHONE_NUMBER_ID` | לשליחה | Phone number ID של מספר הוואטסאפ ב־Graph API |
| `META_APP_SECRET` | חובה ל־webhook | App Secret – לאימות חתימת `X-Hub-Signature-256` ב־POST |
| `WHATSAPP_VERIFY_TOKEN` | חובה ל־webhook | אותה מחרוזת שהגדרת ב־Meta ב־Webhook Verify Token (ל־GET) |
| `META_GRAPH_API_VERSION` | אופציונלי | ברירת מחדל `v20.0` ב־[`lib/whatsapp/meta.ts`](lib/whatsapp/meta.ts) |

**בדיקה מהירה:** אם `META_ACCESS_TOKEN` או `META_PHONE_NUMBER_ID` חסרים – שליחת וואטסאפ תיכשל (הקוד מדווח בלוג וב־`whatsapp_outbound_messages` עם `status=error`).

**תבניות (Templates):** בתוך חלון ה־24 שעות אפשר הודעות סשן חופשיות; מחוץ לחלון נדרשות הודעות מאושרות מסוג Template ב־Meta (לא ממומש אוטומטית בקוד – תלוי במדיניות השליחה שלכם).

**תור `whatsapp_outbound_messages`:** כל שליחה דרך Meta נרשמת בטבלה (לוג + מפתח idempotency במקומות רלוונטיים). **אין** כרגע worker שמריץ retry אוטומטי על שורות `error` – השליחה היא ישירות ל־Graph API; ניתן להרחיב בעתיד.

אחרי הוספת משתנים – **Redeploy** כדי שהשינויים ייכנסו.

---

## 3. Supabase – כתובות להרשאה

כדי שהתחברות ואיפוס סיסמה יעבדו מהדומיין החדש:

1. ב־**Supabase Dashboard** → **Authentication** → **URL Configuration**.
2. ב־**Redirect URLs** הוסף את כתובת האתר:
   - `https://your-app.vercel.app/**`
   - אם יש דומיין מותאם: `https://yourdomain.co.il/**`
3. ב־**Site URL** (אופציונלי) אפשר להגדיר את כתובת האתר הראשית.

---

## 4. Resend – דומיין לשליחת מיילים (אופציונלי)

- ברירת מחדל: המיילים יוצאים מ־`onboarding@resend.dev` (מוגבל).
- לשליחה מדומיין משלך: ב־Resend הוסף דומיין ואימות, והגדר `RESEND_FROM_EMAIL` בהתאם.
- אם קישורים במייל לא נפתחים כראוי: ב־Resend → Domains → כבה **Click tracking** לקישורים ישירים.

---

## 5. Cron (תזכורות וסיכום לובי)

ב־`vercel.json` כבר מוגדרים:

- **תזכורת 5 ימים** – `/api/cron/reminders` (כל יום ב־09:00).
- **סיכום לובי יומי** – `/api/cron/lobby-summary` (כל יום ב־08:00).

ב־Vercel ה־Cron רץ אוטומטית; הוא שולח ל־endpoint עם כותרת:

`Authorization: Bearer <CRON_SECRET>`

**חובה** להגדיר `CRON_SECRET` ב־Environment Variables (מחרוזת אקראית ארוכה) – אחרת הקריאות יוחזרו 401.

---

## 6. בדיקה אחרי העלאה

1. **דף נחיתה** – טופס שליחת שאלה.
2. **התחברות** – `/login` עם משתמש קיים.
3. **קישור ממייל** – שלח לעצמך קישור שיבוץ/איפוס סיסמה ובדוק שהוא מוביל לאתר ופותח נכון.
4. **מנהל** – כניסה ל־`/admin` ובדיקת לוח בקרה וניווט.

אם משהו לא עובד – בדוק ב־Vercel את ה־**Logs** ואת משתני הסביבה.

---

## 7. דומיין מותאם (אופציונלי)

ב־Vercel: **Project → Settings → Domains** – הוסף דומיין משלך. אחר כך עדכן:

- `NEXT_PUBLIC_APP_URL` לכתובת החדשה.
- ב־Supabase את **Redirect URLs** וה־**Site URL** בהתאם.

---

סיכום: העלאה ל־Vercel, מילוי משתני סביבה (במיוחד Supabase, Resend ו־`NEXT_PUBLIC_APP_URL`), הוספת Redirect URLs ב־Supabase – ואפשר לפתוח את האתר למשתמשים.
