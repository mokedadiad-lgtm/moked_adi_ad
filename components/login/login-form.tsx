"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginFormProps = {
  initialError?: string;
  nextUrl?: string;
};

export function LoginForm({ initialError, nextUrl }: LoginFormProps = {}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

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

      const redirectTo = nextUrl && nextUrl.startsWith("/") ? nextUrl : null;
      if (profile?.is_admin || profile?.is_technical_lead) {
        router.replace(redirectTo ?? "/admin");
        router.refresh();
        return;
      }
      if (profile?.is_respondent) {
        router.replace(redirectTo ?? "/respondent");
        router.refresh();
        return;
      }
      if (profile?.is_proofreader) {
        router.replace(redirectTo ?? "/proofreader");
        router.refresh();
        return;
      }

      router.replace(redirectTo ?? "/admin");
      router.refresh();
    } catch {
      setError("אירעה שגיאה. נסו שוב.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden rounded-2xl shadow-dialog">
      <CardHeader className="space-y-1 text-start">
        <CardTitle className="text-2xl font-bold text-primary">
          כניסת צוות - אסק מי פלוס
        </CardTitle>
        <CardDescription className="text-slate-600">
          הכנס פרטי התחברות כדי לגשת למערכת
        </CardDescription>
      </CardHeader>
      <CardContent className="text-start">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">אימייל</Label>
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
            <Label htmlFor="login-password">סיסמה</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="text-start"
              disabled={loading}
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-start text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading}
          >
            {loading ? "מתחבר…" : "התחברות"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
