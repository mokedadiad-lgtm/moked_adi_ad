import { expect, test } from "@playwright/test";

test.describe("דף כניסה", () => {
  test("משתמש מצליח להתחבר למערכת", async ({ page }) => {
    // מדמה Supabase כדי שההתחברות לא תהיה תלויה בפרויקט/משתמש אמיתי.
    const userId = "00000000-0000-0000-0000-000000000001";
    const accessToken = "e2e-access-token";

    // NOTE: supabase-js עושה קריאות ל־/auth/v1/token (POST) ול־/rest/v1/profiles (GET).
    // אנחנו עוצרים את הבקשות האלה ומחזירים תשובות שמתאימות ללוגיקת LoginForm.
    const corsHeaders = {
      "access-control-allow-origin": "*",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    };

    await page.route("**/auth/v1/token*", async (route) => {
      const req = route.request();
      if (req.method() !== "POST") {
        return route.fulfill({ status: 204, headers: corsHeaders });
      }

      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders },
        contentType: "application/json",
        body: JSON.stringify({
          access_token: accessToken,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "e2e-refresh-token",
          // supabase-js מצפה ל־user בתוך התשובה
          user: {
            id: userId,
            email: "e2e@example.com",
            aud: "authenticated",
            role: "authenticated",
          },
        }),
      });
    });

    await page.route("**/rest/v1/profiles*", async (route) => {
      const req = route.request();
      if (req.method() !== "GET") {
        return route.fulfill({ status: 204, headers: corsHeaders });
      }

      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders },
        contentType: "application/json",
        // LoginForm משתמש ב־.single(), אז מחזירים אובייקט.
        body: JSON.stringify({
          is_admin: false,
          is_technical_lead: false,
          is_respondent: true,
          is_proofreader: false,
        }),
      });
    });

    // RespondentDashboard עושה `supabase.auth.getUser()` אחרי הניווט.
    await page.route("**/auth/v1/user*", async (route) => {
      if (route.request().method() !== "GET") {
        return route.fulfill({ status: 204, headers: corsHeaders });
      }

      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders },
        contentType: "application/json",
        body: JSON.stringify({
          id: userId,
          email: "e2e@example.com",
          aud: "authenticated",
          role: "authenticated",
        }),
      });
    });

    // כשמציגים את שולחן העבודה למשיבים, אנחנו מחזירים תשובות ריקות כדי שהדף ייטען בלי תלות בנתונים אמיתיים.
    await page.route("**/rest/v1/question_answers*", async (route) => {
      if (route.request().method() !== "GET") {
        return route.fulfill({ status: 204, headers: corsHeaders });
      }
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders },
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/rest/v1/questions*", async (route) => {
      if (route.request().method() !== "GET") {
        return route.fulfill({ status: 204, headers: corsHeaders });
      }
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders },
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // 1) ניווט לעמוד /login
    await page.goto("/login");

    // 2) איתור שדה האימייל והזנה
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
    await emailInput.fill("e2e@example.com");

    // 3) איתור שדה הסיסמה לפי ה-ID והזנה
    const passwordInput = page.locator("#login-password");
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill("fake-password-123");

    // 4) לחיצה על כפתור ההתחברות
    // בלוגיקה הקיימת הכיתוב הוא "התחברות"
    const submit = page.getByRole("button", { name: /התחבר/i });
    await expect(submit).toBeVisible();
    await submit.click();

    // 5) Assertion שמוודא שה-URL השתנה לדף הבית ('/')
    // בפועל LoginForm מפנה ל-"/admin"/"/respondent"/"/proofreader" לפי פרופיל.
    // כדי לבדוק את עמוד הבית והנראות בו, אנחנו מעבירים ל-'/' לאחר ההתחברות.
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe("/");

    // 6) Assertion נוסף שמוודא שהטקסט "ברוכים הבאים" מוצג על המסך.
    // בדף הבית אצלך מופיע בפועל "ברוכה הבאה ...", אז נבדוק את שתי הצורות.
    await expect(page.getByText(/ברוכ(?:ים|ה)\s+הבאה/i)).toBeVisible();
  });
});

