import { expect, test } from "@playwright/test";

test.describe("דף כניסה", () => {
  test("מציג כותרת וטופס התחברות", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /כניסת צוות/ })).toBeVisible();
    await expect(page.getByLabel("אימייל")).toBeVisible();
    // "סיסמה" מופיע גם ב־aria-label של כפתור הצג/הסתר — לא משתמשים ב־getByLabel("סיסמה")
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.getByRole("button", { name: "התחברות" })).toBeVisible();
    await expect(page.getByRole("link", { name: /טופס שליחת שאלה/ })).toBeVisible();
  });
});

test.describe("דף הבית (טופס פונה)", () => {
  test("מציג את טופס השאלה", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/ברוכה הבאה למוקד/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /דיסקרטיות מלאה/ })).toBeVisible();
  });
});
