"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoadingSpinner } from "@/components/ui/page-loading";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [showSetNewPassword, setShowSetNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [newPasswordSuccess, setNewPasswordSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);

  const toFriendlyResetError = (msg: string | null | undefined): string => {
    const m = (msg ?? "").toLowerCase();
    if (!m) return "לא הצלחנו לשלוח כרגע מייל איפוס. נסו שוב בעוד כמה דקות.";
    if (m.includes("error sending recovery email")) {
      return "לא הצלחנו לשלוח כרגע מייל איפוס. נא לבדוק את הגדרות המייל במערכת ולנסות שוב.";
    }
    if (m.includes("invalid email")) {
      return "כתובת האימייל אינה תקינה.";
    }
    if (m.includes("rate limit") || m.includes("too many")) {
      return "בוצעו יותר מדי ניסיונות. נא להמתין כמה דקות ולנסות שוב.";
    }
    return "לא הצלחנו לשלוח כרגע מייל איפוס. נסו שוב מאוחר יותר.";
  };

  const toFriendlyNewPasswordError = (msg: string | null | undefined): string => {
    const m = (msg ?? "").toLowerCase();
    if (!m) return "לא הצלחנו לעדכן את הסיסמה כרגע. נסו שוב.";
    if (m.includes("new password should be different from the old password")) {
      return "הסיסמה החדשה חייבת להיות שונה מהסיסמה הקודמת.";
    }
    if (m.includes("password should be at least")) {
      return "הסיסמה חייבת להכיל לפחות 6 תווים.";
    }
    if (m.includes("same password")) {
      return "הסיסמה החדשה חייבת להיות שונה מהסיסמה הקודמת.";
    }
    return "לא הצלחנו לעדכן את הסיסמה כרגע. נסו שוב מאוחר יותר.";
  };

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setShowSetNewPassword(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      // יש להוסיף ב-Supabase: Authentication → URL Configuration → Redirect URLs את https://הדומיין-שלך/login
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/login` : "";
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (err) {
        setResetError(toFriendlyResetError(err.message));
        setLoading(false);
        return;
      }
      setResetSent(true);
    } catch {
      setResetError("אירעה שגיאה. נסו שוב.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewPasswordError(null);
    if (newPassword.length < 6) {
      setNewPasswordError("הסיסמה חייבת להכיל לפחות 6 תווים.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setNewPasswordError("הסיסמאות לא תואמות.");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) {
        setNewPasswordError(toFriendlyNewPasswordError(err.message));
        setLoading(false);
        return;
      }
      await supabase.auth.signOut();
      setNewPasswordSuccess(true);
    } catch {
      setNewPasswordError("אירעה שגיאה. נסו שוב.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // נותן ל-React לצייר "מתחבר…" לפני שמתחילים את הבקשה ל-Supabase
    await new Promise<void>((r) => setTimeout(r, 0));

    let didNavigate = false;
    try {
      const supabase = getSupabaseBrowser();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("אימייל או סיסמה שגויים. נסו שוב.");
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        setError("שגיאה באימות. נסו שוב.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, is_technical_lead, is_respondent, is_proofreader")
        .eq("id", userId)
        .single();

      didNavigate = true;
      const isAdminOrTechLead = profile?.is_admin === true || profile?.is_technical_lead === true;
      if (isAdminOrTechLead) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      if (profile?.is_respondent) {
        router.replace("/respondent");
        router.refresh();
        return;
      }
      if (profile?.is_proofreader) {
        router.replace("/proofreader");
        router.refresh();
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("אירעה שגיאה. נסו שוב.");
    } finally {
      if (!didNavigate) setLoading(false);
    }
  };

  if (newPasswordSuccess) {
    return (
      <Card className="overflow-hidden rounded-2xl shadow-dialog">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-xl font-bold text-primary">סיסמה עודכנה</CardTitle>
          <CardDescription className="text-slate-600">
            כעת תוכל/י להתחבר עם הסיסמה החדשה.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button
            type="button"
            className="w-full"
            size="lg"
            onClick={() => {
              setShowSetNewPassword(false);
              setNewPasswordSuccess(false);
              setNewPassword("");
              setNewPasswordConfirm("");
            }}
          >
            חזרה להתחברות
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (showSetNewPassword) {
    return (
      <Card className="overflow-hidden rounded-2xl shadow-dialog">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-xl font-bold text-primary">הגדר סיסמה חדשה</CardTitle>
          <CardDescription className="text-slate-600">
            הזן/י סיסמה חדשה (לפחות 6 תווים).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <form onSubmit={handleSetNewPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="block text-center">סיסמה חדשה</Label>
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="pe-10 text-start"
                disabled={loading}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label={showNewPassword ? "הסתר סיסמה" : "הצג סיסמה"}
              >
                {showNewPassword ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password-confirm" className="block text-center">אימות סיסמה</Label>
              <div className="relative">
                <Input
                  id="new-password-confirm"
                  type={showNewPasswordConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  required
                  className="pe-10 text-start"
                  disabled={loading}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowNewPasswordConfirm((v) => !v)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label={showNewPasswordConfirm ? "הסתר סיסמה" : "הצג סיסמה"}
                >
                  {showNewPasswordConfirm ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            {newPasswordError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700" role="alert">
                {newPasswordError}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2" role="status" aria-live="polite">
                  <span className="sr-only">מעדכן…</span>
                  <PageLoadingSpinner size="sm" variant="onPrimary" />
                </span>
              ) : (
                "עדכן סיסמה"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setShowSetNewPassword(false)}
              disabled={loading}
            >
              ביטול
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (showForgotPassword) {
    return (
      <Card className="overflow-hidden rounded-2xl shadow-dialog">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-xl font-bold text-primary">שכחתי סיסמה</CardTitle>
          <CardDescription className="text-center text-slate-600">
            {resetSent
              ? "נשלח אליך אימייל עם קישור לאיפוס הסיסמה."
              : "הזן/י את האימייל שלך ונשלח אליך קישור לאיפוס הסיסמה."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {resetSent ? (
            <p className="mb-4 text-center text-sm text-slate-600">
              בדוק/י את תיבת הדואר (וגם בתיקיית הספאם). הקישור בתוקף למשך שעה.
            </p>
          ) : (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="block text-center">אימייל</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-start"
                  disabled={loading}
                />
              </div>
              {resetError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700" role="alert">
                  {resetError}
                </p>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2" role="status" aria-live="polite">
                    <span className="sr-only">שולח…</span>
                    <PageLoadingSpinner size="sm" variant="onPrimary" />
                  </span>
                ) : (
                  "שלח קישור לאיפוס"
                )}
              </Button>
            </form>
          )}
          <Button
            type="button"
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => {
              setShowForgotPassword(false);
              setResetSent(false);
              setResetError(null);
            }}
          >
            חזרה להתחברות
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl shadow-dialog">
      <CardHeader className="space-y-1 flex flex-col items-center text-center">
        <CardTitle className="text-2xl font-bold text-center text-primary">
          כניסת צוות - אסק מי פלוס
        </CardTitle>
        <CardDescription className="text-muted-foreground text-center">
          הכנס פרטי התחברות כדי לגשת למערכת
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email" className="block text-center">אימייל</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-start"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password" className="block text-center">סיסמה</Label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pe-10 text-start"
                disabled={loading}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
              >
                {showPassword ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <span className="inline-flex items-center justify-center" role="status" aria-live="polite">
                <span className="sr-only">טוען…</span>
                <PageLoadingSpinner size="sm" variant="onPrimary" />
              </span>
            ) : (
              "התחברות"
            )}
          </Button>
          <button
            type="button"
            className="mt-2 w-full text-center text-sm text-primary underline hover:no-underline"
            onClick={() => setShowForgotPassword(true)}
          >
            שכחתי סיסמה
          </button>
          <p className="mt-4 pt-4 border-t border-slate-200 text-center text-sm text-slate-600">
            <Link href="/" className="text-primary font-medium underline hover:no-underline">
              טופס שליחת שאלה
            </Link>
            {" "}
            (למשתמשים)
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
