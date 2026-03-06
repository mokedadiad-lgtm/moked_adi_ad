# ביקורת אבטחה – Supabase והמערכת

## סיכום ביצועים

- **מפתחות:** שימוש נכון ב-Anon (לקוח) ו-Service Role (שרת בלבד).
- **RLS:** מופעל על כל הטבלאות; מדיניות תואמות לתפקידים (אדמין, משיב, מגיה, עורך לשוני).
- **API:** נתיבי PDF ושליחה מוגנים באימות (אדמין/עורך לשוני).
- **Cron:** מוגן עם `CRON_SECRET`.
- **Storage:** העלאה למאומתים, קריאה ציבורית ל־bucket של PDF (לפי design).

---

## 1. משתני סביבה

| משתנה | שימוש | חשוף ללקוח? |
|--------|--------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | כתובת הפרויקט | כן (נדרש לדפדפן) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | לקוח דפדפן + אימות ב-API | כן |
| `SUPABASE_SERVICE_ROLE_KEY` | שרת בלבד (Admin, Cron, Server Actions) | **לא** – רק בשרת |

**חובה:** `SUPABASE_SERVICE_ROLE_KEY` לא יופיע בקוד צד-לקוח ולא ב-`NEXT_PUBLIC_*`.

---

## 2. חיבורי Supabase

### לקוח (דפדפן)

- **קובץ:** `lib/supabase/client.ts`
- **מפתח:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **שימוש:** כניסה, פרופיל, לובי מגיהים, משיבים, עריכת שאלות (RLS חל).

### שרת (Service Role)

- **קובץ:** `lib/supabase/server.ts`
- **מפתח:** `SUPABASE_SERVICE_ROLE_KEY`
- **שימוש:**  
  - Server Actions ב־`app/admin/actions.ts`  
  - דפי אדמין (נתונים)  
  - API: PDF, שליחה, הורדת PDF, Cron  
  - `app/actions/submit-question.ts` (הגשת שאלה אנונימית)  
  - `app/actions/notifications.ts`  

**הערה:** דפי אדמין ופעולות אדמין ניגשים לנתונים עם Service Role. הגנה על נתיבי הניהול מתבצעת ב־**middleware** (ראו להלן).

---

## 3. הגנה על API Routes

| Route | אימות | הערות |
|-------|--------|--------|
| `POST /api/questions/[id]/pdf` | כן – `requireAdminOrLinguistic` | אדמין או עורך לשוני; JWT ב־`Authorization: Bearer` |
| `POST /api/questions/[id]/send` | כן – `requireAdminOrLinguistic` | אדמין או עורך לשוני |
| `GET /api/questions/[id]/pdf/download` | כן | **for=asker:** טוקן ב־query (`token=`) תוקף 30 יום; **for=archive:** אימות מעוגיות (אדמין/עורך/technical lead) |
| `GET/POST /api/cron/reminders` | כן – `CRON_SECRET` ב־Authorization | רק עם סוד מתאים |
| `GET/POST /api/cron/lobby-summary` | כן – `CRON_SECRET` | רק עם סוד מתאים |

הלקוח שולח JWT דרך `getAuthHeaders()` מ־`lib/supabase/client.ts` בבקשות ל־PDF ו־send.

---

## 3א. Middleware – הגנה על דפי ניהול

- **קובץ:** `middleware.ts` (שורש הפרויקט)
- **נתיבים:** `/admin`, `/admin/*`
- **לוגיקה:** קריאת סשן מ־cookies (Supabase SSR), בדיקת פרופיל `is_admin` או `is_technical_lead`. אם אין משתמש → הפניה ל־`/login?next=...`. אם משתמש ללא הרשאה → הפניה ל־`/login?error=forbidden&next=...`.
- **תלות:** `@supabase/ssr`, לקוח דפדפן עם `createBrowserClient` (סשן נשמר ב־cookies).

---

## 4. RLS – טבלאות ומדיניות

### questions

- **אדמין:** `questions_admin_all` – ALL (SELECT/INSERT/UPDATE/DELETE).
- **משיב:** SELECT רק כשהשאלה אצלו; UPDATE רק לשאלה שמוקצית אליו (כולל מעבר ללובי).
- **מגיה:** SELECT ללובי (לפי `proofreader_type_id`) ולשאלות שתפס; UPDATE לשאלות שתפס (claim/release/return).
- **עורך לשוני:** SELECT לשלב עריכה לשונית ומוכן לשליחה.
- **הכנסה:** `questions_insert` – מאומת (בפועל שאלות אנונימיות נשלחות דרך Server Action עם Service Role).

### profiles

- SELECT: המשתמש על עצמו, או אדמין על כולם.
- UPDATE: המשתמש על עצמו; אדמין על כולם.

### archives

- SELECT: אדמין ועורך לשוני בלבד.

### question_response_versions

- SELECT: אדמין בלבד.
- INSERT: **מגבלה מעודכנת** – רק כאשר `edited_by = auth.uid()` (מאפשר לטריגר `save_response_version` להכניס גרסאות).

### proofreader_types, topics, sub_topics

- SELECT: מאומתים.
- ניהול (ALL): אדמין בלבד.

### Storage (response-pdfs)

- INSERT: מאומתים (בפועל העלאה דרך API עם Service Role).
- SELECT: ציבורי (bucket ציבורי ל־PDF).

---

## 5. RPC ו־Security Definer

- **submit_respondent_response:** `SECURITY DEFINER`, בודק `assigned_respondent_id = auth.uid()` לפני עדכון.  
- **save_response_version:** `SECURITY DEFINER`, מכניס גרסה עם `edited_by = auth.uid()`.  
- **my_profile():** `SECURITY DEFINER`, מחזיר פרופיל המשתמש הנוכחי (לשימוש ב־RLS).

---

## 6. אבטחת הורדת PDF לשואלים

- **טבלה:** `questions.asker_download_token`, `questions.asker_download_token_expires_at` (מיגרציה `20260222210000_questions_asker_download_token.sql`).
- **בשליחת מייל (send):** נוצר טוקן אקראי (32 bytes hex), תוקף 30 יום, נשמר בשאלה. הקישור במייל: `.../pdf/download?for=asker&token=...`.
- **ב־download route:** כאשר `for=asker` – חובה פרמטר `token`, התאמה ל־`asker_download_token` ובדיקת תאריך תפוגה. ללא טוקן תקף → 403.

## 7. המלצות להמשך

1. **הגשת שאלה אנונימית:** לשקול rate limiting (ב־Supabase או בשכבת האפליקציה) נגד ספאם.
2. **משתנה CRON_SECRET:** להגדיר ב־Vercel/סביבת פריסה ולהשתמש בו רק ב־Cron.

---

## 8. קבצים רלוונטיים

- `lib/supabase/client.ts` – לקוח דפדפן (createBrowserClient מ־@supabase/ssr) + `getAuthHeaders()`
- `lib/supabase/server.ts` – Service Role
- `lib/supabase/server-auth.ts` – `getServerAuthUser()`, `isAdminOrLinguisticOrTechnicalLead()` (אימות מעוגיות)
- `lib/supabase/middleware.ts` – יצירת Supabase client ל־middleware
- `lib/auth-api.ts` – `requireAdminOrLinguistic()` ל־API (JWT)
- `middleware.ts` – הגנה על `/admin`
- `supabase/migrations/*.sql` – סכמה ו־RLS
- `app/api/questions/[id]/pdf/route.ts` – אימות לפני יצירת PDF
- `app/api/questions/[id]/send/route.ts` – אימות לפני שליחה + יצירת טוקן הורדה לשואל
- `app/api/questions/[id]/pdf/download/route.ts` – אימות טוקן (שואל) או cookies (ארכיון)
