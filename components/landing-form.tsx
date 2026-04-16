"use client";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitQuestion, type SubmitState } from "@/app/actions/submit-question";
import { ASKER_AGE_RANGE_LABELS } from "@/lib/asker-age-ranges";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { startTransition, useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  asker_email: z.string().min(1, "נא להזין אימייל לשליחת המענה.").email("נא להזין אימייל תקין."),
  asker_gender: z.enum(["M", "F"]).optional(),
  asker_age: z.enum(ASKER_AGE_RANGE_LABELS, { message: "נא לבחור טווח גיל." }),
  title: z.string().min(1, "נא להזין כותרת השאלה."),
  content: z.string().min(1, "נא להזין את פירוט השאלה."),
  response_type: z.enum(["short", "detailed"]),
  publication_consent: z.enum(["publish", "blur", "none"]),
  terms_accepted: z.boolean().refine((v) => v === true, { message: "נא לאשר את תנאי השימוש." }),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  asker_email: "",
  asker_gender: undefined,
  asker_age: "23-26",
  title: "",
  content: "",
  response_type: "short",
  publication_consent: "publish",
  terms_accepted: false,
};

function formDataFromValues(values: FormValues): FormData {
  const fd = new FormData();
  fd.set("asker_email", values.asker_email);
  if (values.asker_gender) fd.set("asker_gender", values.asker_gender);
  fd.set("asker_age", values.asker_age ?? "");
  fd.set("title", values.title);
  fd.set("content", values.content);
  fd.set("response_type", values.response_type);
  fd.set("publication_consent", values.publication_consent);
  fd.set("terms_accepted", values.terms_accepted ? "on" : "");
  return fd;
}

export function LandingForm() {
  const [state, formAction, isPending] = useActionState<SubmitState | null, FormData>(
    async (_prev, formData) => submitQuestion(formData),
    null
  );
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    if (state?.ok === true) setSubmitted(true);
  }, [state]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      formAction(formDataFromValues(values));
    });
  });

  if (submitted && state?.ok) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-slate-200/80 bg-white p-6 text-center shadow-sm"
      >
        <p className="text-base font-semibold text-primary">השאלה נשלחה בהצלחה</p>
        <p className="mt-1.5 text-sm text-slate-600">
          נשתדל להחזיר לך תשובה בהתאם למסלול שבחרת, בעז&quot;ה.
        </p>
      </motion.section>
    );
  }

  return (
    <>
      <div className="mb-6 flex justify-center">
        <BrandLogo
          priority
          imageClassName="max-w-[80px] sm:max-w-[92px] md:max-w-[100px]"
        />
      </div>
      <div className="mb-5 text-center">
        <p className="mb-1.5 text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">
          ברוכה הבאה למוקד אסק-מי פלוס
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          כאן ניתן להשאיר את השאלה שלך ואנו נשתדל לענות עליה בעז&quot;ה.
          <br />
          נא לענות על השאלות הבאות ולאשר את התקנון.
        </p>
      </div>

      <section className="mb-6 rounded-xl border border-amber-300/80 bg-amber-50 p-4 text-center shadow-sm">
        <h2 className="mb-2 flex items-center justify-center gap-1.5 text-base font-bold text-amber-800">
          <span>🔒</span> דיסקרטיות מלאה
        </h2>
        <p className="text-xs leading-relaxed text-slate-600">
          הכל נשאר חסוי ואנונימי. אנו מתחייבים לשמור על דיסקרטיות מלאה, ולכן גם
          אם יש פרטים שידועים לנו על הפונה, הם חסויים וישארו כך. למעט מקרים בהם
          מתקיים נוהל חירום והצלת חיים, שבהם אנו מחויבים על פי חוק ומוסריות לעשות כל מאמץ להציל חיים.
        </p>
      </section>

      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-5 text-center">
      {/* פרטי פונה: אימייל, מין, גיל */}
      <section className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 place-items-center gap-3 md:grid-cols-3 md:items-start md:justify-items-center">
          <div className="w-full max-w-xs space-y-1.5">
            <Label htmlFor="asker_email" className="text-base font-bold">אימייל (לשליחת המענה)</Label>
            <Input
              id="asker_email"
              type="email"
              placeholder="example@email.com"
              {...form.register("asker_email")}
              className="text-center"
            />
            {form.formState.errors.asker_email && (
              <p className="text-center text-xs text-red-600">{form.formState.errors.asker_email.message}</p>
            )}
          </div>
          <div className="flex w-full max-w-xs flex-col items-center gap-1.5 md:max-w-none">
            <Label className="text-base font-bold">מין</Label>
            <div className="flex flex-row justify-center gap-2">
              <button
                type="button"
                onClick={() => form.setValue("asker_gender", "F")}
                className={`rounded-lg border-2 px-4 py-2 text-sm transition-all ${
                  form.watch("asker_gender") === "F"
                    ? "border-red-400 bg-red-100 text-red-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-red-200"
                }`}
              >
                נקבה
              </button>
              <button
                type="button"
                onClick={() => form.setValue("asker_gender", "M")}
                className={`rounded-lg border-2 px-4 py-2 text-sm transition-all ${
                  form.watch("asker_gender") === "M"
                    ? "border-blue-400 bg-blue-100 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
                }`}
              >
                זכר
              </button>
            </div>
          </div>
          <div className="w-full max-w-[220px] space-y-1.5">
            <Label htmlFor="asker_age" className="text-base font-bold">גיל</Label>
            <Select
              value={form.watch("asker_age")}
              onValueChange={(v) => form.setValue("asker_age", v as FormValues["asker_age"])}
            >
              <SelectTrigger id="asker_age" className="w-full text-center">
                <SelectValue placeholder="בחר/י טווח גיל" />
              </SelectTrigger>
              <SelectContent>
                {ASKER_AGE_RANGE_LABELS.map((label) => (
                  <SelectItem key={label} value={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.asker_age && (
              <p className="text-center text-xs text-red-600">{form.formState.errors.asker_age.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* השאלה: כותרת ופרטים */}
      <section className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-base font-bold">כותרת השאלה</Label>
          <Input
            id="title"
            type="text"
            placeholder="למשל: שאלה על ברכות"
            {...form.register("title")}
            className="mx-auto max-w-md text-center"
          />
          {form.formState.errors.title && (
            <p className="text-center text-xs text-red-600">{form.formState.errors.title.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="content" className="text-base font-bold">פירוט השאלה</Label>
          <Textarea
            id="content"
            placeholder={form.watch("asker_gender") === "M" ? "כתוב כאן את שאלתך..." : "כתבי כאן את שאלתך..."}
            rows={Math.max(3, Math.min(12, (form.watch("content") || "").split("\n").length))}
            {...form.register("content")}
            className="mx-auto max-w-full min-h-0 text-center resize-y"
          />
          {form.formState.errors.content && (
            <p className="text-center text-xs text-red-600">{form.formState.errors.content.message}</p>
          )}
        </div>
      </section>

      {/* בחירת מסלול */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <Label className="mb-3 block text-center text-base font-bold">בחירת מסלול</Label>
        <RadioGroup
          value={form.watch("response_type")}
          onValueChange={(v) => form.setValue("response_type", v as "short" | "detailed")}
          className="mx-auto grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {/* תשובה מפורטת — שמאל, אדום */}
          <label
            className={`order-2 cursor-pointer rounded-lg border-2 p-3 text-center transition-all sm:order-1 ${
              form.watch("response_type") === "detailed"
                ? "border-red-600 bg-red-50"
                : "border-slate-200 bg-white hover:border-red-200"
            }`}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <RadioGroupItem value="detailed" id="route_detailed" className="shrink-0" />
              <div>
                <span className={`text-sm font-medium ${form.watch("response_type") === "detailed" ? "text-red-700" : "text-red-600"}`}>
                  תשובה מפורטת
                </span>
                <p className="mt-0.5 text-xs text-slate-600" dir="rtl">
                  <span className="font-bold">תשובה מקיפה, ארוכה ומורחבת</span>
                  <br />
                  (תוך כ־4 שבועות){"\u200E"}.
                </p>
              </div>
            </div>
          </label>
          {/* קצר ולעניין — ימין, ירוק */}
          <label
            className={`order-1 cursor-pointer rounded-lg border-2 p-3 text-center transition-all sm:order-2 ${
              form.watch("response_type") === "short"
                ? "border-green-600 bg-green-50"
                : "border-slate-200 bg-white hover:border-green-200"
            }`}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <RadioGroupItem value="short" id="route_short" className="shrink-0" />
              <div>
                <span className={`text-sm font-medium ${form.watch("response_type") === "short" ? "text-green-700" : "text-green-600"}`}>
                  קצר ולעניין
                </span>
                <p className="mt-0.5 text-xs text-slate-600" dir="rtl">
                  <span className="font-bold">תשובה קצרה, מתומצתת ומעשית</span>
                  <br />
                  (תוך כ־3 שבועות){"\u200E"}.
                </p>
              </div>
            </div>
          </label>
        </RadioGroup>
        <p className="mt-2 text-center text-xs text-slate-500">
          * לעיתים רחוקות ייתכנו עיכובים במענה, אנו עושים כל מאמץ, בעז&quot;ה, לצמצם
          זאת ככל האפשר.
        </p>
      </section>

      {/* פרסום והסכמה */}
      <section className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <Label className="block text-center text-base font-bold">פרסום והסכמה</Label>
        <Select
          value={form.watch("publication_consent")}
          onValueChange={(v) => form.setValue("publication_consent", v as "publish" | "blur" | "none")}
        >
          <SelectTrigger className="mx-auto max-w-md">
            <SelectValue placeholder={form.watch("asker_gender") === "M" ? "בחר אפשרות פרסום" : "בחרי אפשרות פרסום"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="publish">
              <span dir="rtl">
                {form.watch("asker_gender") === "M" ? "אני מסכים לפרסם את השאלה שלי" : "אני מסכימה לפרסם את השאלה שלי"}
                {"\u200E"}.
              </span>
            </SelectItem>
            <SelectItem value="blur">
              <span dir="rtl">
                {form.watch("asker_gender") === "M" ? "אני מסכים לפרסם בטשטוש נתונים" : "אני מסכימה לפרסם בטשטוש נתונים"}
                {"\u200E"}.
              </span>
            </SelectItem>
            <SelectItem value="none">
              <span dir="rtl">השאלה שלי לא לפרסום{"\u200E"}.</span>
            </SelectItem>
          </SelectContent>
        </Select>

        <p className="text-center text-xs leading-relaxed text-slate-600">
          {form.watch("asker_gender") === "M"
            ? "פעמים רבות השאלות שאנו נשאלים יכולות לסייע למתמודדים נוספים. אתה חשוב לנו ולעולם לא נפרסם את השאלה שלך אם לא תסכים."
            : "פעמים רבות השאלות שאנו נשאלים יכולות לסייע למתמודדות נוספות. את חשובה לנו ולעולם לא נפרסם את השאלה שלך אם לא תסכימי."}
        </p>
        <p className="text-center text-xs leading-relaxed text-slate-600">
          {form.watch("asker_gender") === "M"
            ? "את התשובות שאנו עונים יש לנו את הזכות לפרסם לתועלת נערים נוספים, בטשטוש פרטים מזהים."
            : "את התשובות שאנו עונים יש לנו את הזכות לפרסם לתועלת נערות נוספות, בטשטוש פרטים מזהים."}
        </p>
      </section>

      {state?.ok === false && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-700">{state.error}</p>
      )}

      <div className="flex flex-col items-center gap-2 pt-1">
        <label className="flex cursor-pointer items-center gap-2 text-center">
          <Checkbox
            checked={form.watch("terms_accepted")}
            onCheckedChange={(v) => form.setValue("terms_accepted", !!v)}
          />
          <span className="text-xs text-slate-600" dir="rtl">
            {form.watch("asker_gender") === "M"
              ? "קראתי את תנאי השימוש במוקד ואני מאשר אותם"
              : "קראתי את תנאי השימוש במוקד ואני מאשרת אותם"}
            {"\u200E"}.
          </span>
        </label>
        {form.formState.errors.terms_accepted && (
          <p className="text-center text-xs text-red-600" role="alert">{form.formState.errors.terms_accepted.message}</p>
        )}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-1">
          <Button
            type="submit"
            size="default"
            disabled={isPending}
            className="min-w-[180px]"
          >
            {isPending ? "שולח..." : "שליחה"}
          </Button>
        </motion.div>
      </div>
    </form>
    </>
  );
}
