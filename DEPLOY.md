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

### התראות דחיפה (Web Push) — דואר נכנס WhatsApp לאדמין

| משתנה | חובה | תיאור |
|--------|------|--------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | מומלץ | מפתח VAPID ציבורי (פלט `npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | מומלץ | מפתח VAPID פרטי (רק בשרת) |
| `VAPID_SUBJECT` | מומלץ | לרוב `mailto:` לתמיכה, למשל `mailto:support@yourdomain.com` |

בלי מפתחות אלה ההתראות לא נשלחות; ממשק המנהל עדיין מציג הסבר. להריץ ב־Supabase את המיגרציות: `push_subscriptions`, ועמודות `profiles` להשתקה (`push_notifications_muted_until`, `push_notifications_muted_forever`).

**בדיקה מהירה:** אם `META_ACCESS_TOKEN` או `META_PHONE_NUMBER_ID` חסרים – שליחת וואטסאפ תיכשל (הקוד מדווח בלוג וב־`whatsapp_outbound_messages` עם `status=error`).

### תבניות WhatsApp (הודעות יזומות — מחוץ לחלון 24 שעות)

ב־[WhatsApp Manager](https://business.facebook.com/) יוצרים תבניות **באותה שפה** כמו `WHATSAPP_TEMPLATE_LANGUAGE` (ברירת מחדל בקוד: `he`). אם משתנה `WHATSAPP_TEMPLATE_*` **לא** מוגדר — הקוד שולח **טקסט חופשי** כמו קודם (מתאים בעיקר לחלון 24 שעות). אם מגדירים שם תבנית — נשלח `type: template` עם פרמטרי גוף {{1}}… לפי הסדר למטה.

| משתנה סביבה | תיאור |
|---------------|--------|
| `WHATSAPP_TEMPLATE_LANGUAGE` | אופציונלי — קוד שפה ל־Graph API (ברירת מחדל: `he`) |
| `WHATSAPP_TEMPLATE_LOBBY_NEW_QUESTION` | שם תבנית — לובי: שאלה חדשה |
| `WHATSAPP_TEMPLATE_LINGUISTIC_NEW_QUESTION` | שם תבנית — עריכה לשונית |
| `WHATSAPP_TEMPLATE_RESPONDENT_ASSIGNMENT` | שם תבנית — שיבוץ משיב |
| `WHATSAPP_TEMPLATE_ASKER_PDF_SENT` | שם תבנית — PDF לשואל |
| `WHATSAPP_TEMPLATE_CRON_LOBBY_SUMMARY` | שם תבנית — סיכום לובי יומי (cron) |
| `WHATSAPP_TEMPLATE_CRON_INACTIVITY_REMINDER` | שם תבנית — תזכורת חוסר פעילות 5 ימים |

**גוף התבנית ב־Manager (חייב להתאים לפרמטרים בקוד):**

1. **lobby_new_question** — `{{1}}` = שם בלבד (או תו בלתי נראה אם אין שם); `{{2}}` = `short_id` (או fallback); `{{3}}` = נושא (כולל תת־נושא אם יש). **כפתור URL דינמי**: מקבל suffix לקישור (למשל `api/go?r=...`).
2. **linguistic_new_question** — `{{1}}` = שם בלבד (או תו בלתי נראה אם אין שם); `{{2}}` = `short_id` (או fallback); `{{3}}` = נושא (כולל תת־נושא אם יש). **כפתור URL דינמי**: מקבל suffix.
3. **respondent_assignment** — `{{1}}` = שם בלבד (או תו בלתי נראה אם אין שם); `{{2}}` = נושא; `{{3}}` = הערת מנהל (ריק או `הערת מנהל: …`). **כפתור URL דינמי**: מקבל suffix לקישור השיבוץ.
4. **asker_pdf_sent** — `{{1}}` = URL להורדת PDF.
5. **cron_lobby_summary** — `{{1}}` = מספר משימות (מחרוזת); `{{2}}` = קישור.
6. **cron_inactivity_reminder** — `{{1}}` = שם בלבד (או תו בלתי נראה אם אין שם); `{{2}}` = `משיב/ה` או `מגיה/ה`. **כפתור URL דינמי**: מקבל suffix (קישור למשיב/לובי).

#### נוסחים סופיים לתבניות (להדבקה ל־WhatsApp Manager)

1. **lobby_new_question_v2** (CTA: כפתור URL דינמי)

```text
שלום וברכה {{1}},
נכנסה שאלה חדשה ללובי ההגהה.
*מס' פנייה:* {{2}}
*נושא:* {{3}}
לחץ/י על הכפתור כדי להיכנס לטיפול.
בהצלחה!
```

2. **linguistic_new_question_v2** (CTA: כפתור URL דינמי)

```text
שלום וברכה {{1}},
שאלה הועברה לעריכה לשונית.
*מס' פנייה:* {{2}}
*נושא:* {{3}}
לחץ/י על הכפתור כדי להיכנס.
בהצלחה!
```

3. **respondent_assignment_v2** (CTA: כפתור URL דינמי)

```text
שלום וברכה {{1}},
שובצה לך שאלה חדשה לטיפול בנושא {{2}}.
לחץ/י על הכפתור כדי להיכנס למערכת.
{{3}}
בהצלחה!
```

4. **asker_pdf_sent_v2**

```text
שלום וברכה,

שמחים לעדכן כי צוות אסק מי פלוס השיב לפנייתך.
*להורדת קובץ התשובה (PDF) לחץ/י על הקישור:*
{{1}}

הערה: המידע בתשובה הינו כללי ואינו מהווה תחליף לייעוץ מקצועי אישי.
```

5. **cron_lobby_summary_v2**

```text
שלום וברכה,
היום יש {{1}} משימה/ות ממתינות בלובי ההגהה.
*כניסה:* {{2}}
יום נעים!
```

6. **cron_inactivity_reminder_v2** (CTA: כפתור URL דינמי)

```text
שלום וברכה {{1}},
משימה שהוקצתה אליך כ{{2}} לא עודכנה מזה 5 ימים.
לחץ/י על הכפתור כדי להיכנס.
לטיפולך.
```

#### הגדרת כפתור URL דינמי ב־WhatsApp Manager

בכל אחת מהתבניות עם CTA, להוסיף כפתור מסוג **Call to action → Visit website** עם **Dynamic URL**.\n
להגדיר את ה־URL הבסיסי כ־`NEXT_PUBLIC_APP_URL` ולהוסיף בסוף `/{variable}`. לדוגמה:\n
`https://your-app.vercel.app/{{1}}`\n
הקוד שולח לכפתור רק את ה־suffix (למשל `api/go?r=...`). אם לא ניתן לחלץ suffix, יישלח URL מלא כ־fallback.

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
