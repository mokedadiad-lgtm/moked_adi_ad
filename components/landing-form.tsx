"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { submitQuestion, type SubmitState } from "@/app/actions/submit-question";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { startTransition, useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  asker_email: z.string().min(1, "נא להזין אימייל לקבלת מענה.").email("נא להזין אימייל תקין."),
  asker_gender: z.enum(["M", "F"]).optional(),
  asker_age: z.string().optional(),
  content: z.string().min(1, "נא להזין את פרטי השאלה."),
  response_type: z.enum(["short", "detailed"]),
  publication_consent: z.enum(["publish", "blur", "none"]),
  terms_accepted: z.literal(true, { errorMap: () => ({ message: "נא לאשר את תנאי השימוש." }) }),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  asker_email: "",
  asker_gender: undefined,
  asker_age: "",
  content: "",
  response_type: "short",
  publication_consent: "none",
  terms_accepted: false,
};

function formDataFromValues(values: FormValues): FormData {
  const fd = new FormData();
  fd.set("asker_email", values.asker_email);
  if (values.asker_gender) fd.set("asker_gender", values.asker_gender);
  fd.set("asker_age", values.asker_age ?? "");
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
          נשתדל לחזור אליך בהתאם למסלול שבחרת. בעז&quot;ה.
        </p>
      </motion.section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* שדות הטופס */}
      <section className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-4 text-start shadow-sm">
        {/* אימייל | מין | גיל */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="asker_email">אימייל (לקבלת מענה)</Label>
            <Input
              id="asker_email"
              type="email"
              placeholder="example@email.com"
              {...form.register("asker_email")}
            />
            {form.formState.errors.asker_email && (
              <p className="text-start text-xs text-red-600">{form.formState.errors.asker_email.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:contents">
            <div className="space-y-1.5">
              <Label>מין</Label>
              <RadioGroup
                value={form.watch("asker_gender") ?? ""}
                onValueChange={(v) => form.setValue("asker_gender", v as "M" | "F")}
                className="flex flex-row gap-4 justify-start"
              >
                <label className="flex cursor-pointer items-center gap-1.5 justify-start">
                  <RadioGroupItem value="F" id="gender_f" />
                  <span className="text-xs text-slate-600">נקבה</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 justify-start">
                  <RadioGroupItem value="M" id="gender_m" />
                  <span className="text-xs text-slate-600">זכר</span>
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asker_age">גיל</Label>
              <Input
                id="asker_age"
                type="text"
                placeholder="למשל 24"
                {...form.register("asker_age")}
                className="max-w-full md:max-w-[120px]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="content">פרטי השאלה</Label>
          <Textarea
            id="content"
            placeholder="כתבי כאן את שאלתך..."
            rows={5}
            {...form.register("content")}
          />
          {form.formState.errors.content && (
            <p className="text-start text-xs text-red-600">{form.formState.errors.content.message}</p>
          )}
        </div>
      </section>

      {/* בחירת מסלול */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-4 text-start shadow-sm">
        <Label className="mb-3 block">בחירת מסלול</Label>
        <RadioGroup
          value={form.watch("response_type")}
          onValueChange={(v) => form.setValue("response_type", v as "short" | "detailed")}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <label
            className={`order-2 cursor-pointer rounded-lg border-2 p-3 text-start transition-all sm:order-1 ${
              form.watch("response_type") === "detailed"
                ? "border-primary bg-primary/10"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-start gap-2 justify-start text-start">
              <RadioGroupItem value="detailed" id="route_detailed" className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-sm font-medium text-primary">תשובה מפורטת</span>
                <p className="mt-0.5 text-xs text-slate-600">
                  תשובה מקיפה, ארוכה ומורחבת (תוך כ־4 שבועות).
                </p>
              </div>
            </div>
          </label>
          <label
            className={`order-1 cursor-pointer rounded-lg border-2 p-3 text-start transition-all sm:order-2 ${
              form.watch("response_type") === "short"
                ? "border-primary bg-primary/10"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-start gap-2 justify-start text-start">
              <RadioGroupItem value="short" id="route_short" className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-sm font-medium text-primary">קצר ולעניין</span>
                <p className="mt-0.5 text-xs text-slate-600">
                  תשובה קצרה, מתומצתת ומעשית (תוך כ־3 שבועות).
                </p>
              </div>
            </div>
          </label>
        </RadioGroup>
        <p className="mt-2 text-xs text-slate-500">
          * לעיתים רחוקות ייתכנו עיכובים במענה, אנו עושים כל מאמץ, בעז&quot;ה, לצמצם
          זאת ככל האפשר.
        </p>
      </section>

      {/* פרסום והסכמה */}
      <section className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-4 text-start shadow-sm">
        <Label className="block">פרסום והסכמה</Label>
        <RadioGroup
          value={form.watch("publication_consent")}
          onValueChange={(v) => form.setValue("publication_consent", v as "publish" | "blur" | "none")}
          className="flex flex-row flex-wrap justify-start gap-2"
        >
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 justify-start text-start hover:border-slate-300">
            <RadioGroupItem value="publish" id="pub_publish" className="shrink-0" />
            <span className="text-xs text-slate-600">אני מסכימה לפרסם את השאלה שלי.</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 justify-start text-start hover:border-slate-300">
            <RadioGroupItem value="blur" id="pub_blur" className="shrink-0" />
            <span className="text-xs text-slate-600">אני מסכימה לפרסם בטשטוש נתונים.</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 justify-start text-start hover:border-slate-300">
            <RadioGroupItem value="none" id="pub_none" className="shrink-0" />
            <span className="text-xs text-slate-600">השאלה שלי לא לפרסום.</span>
          </label>
        </RadioGroup>

        <p className="text-xs leading-relaxed text-slate-600">
          פעמים רבות השאלות שאנו נשאלים יכולות לסייע למתמודדות נוספות. את חשוב לנו ולעולם לא נפרסם את השאלה שלך אם לא תסכימי.
        </p>
        <p className="text-xs leading-relaxed text-slate-600">
          את התשובות שאנו עונים יש לנו את הזכות לפרסם לתועלת נערות נוספות, בטשטוש פרטים מזהים.
        </p>

        <div className="flex justify-start pt-1">
          <label className="flex cursor-pointer items-center gap-2 justify-start text-start">
            <Checkbox
              checked={form.watch("terms_accepted")}
              onCheckedChange={(v) => form.setValue("terms_accepted", !!v)}
            />
            <span className="text-xs text-slate-600">
              קראתי את תנאי השימוש במוקד ואני מאשרת אותם.
            </span>
          </label>
        </div>
        {form.formState.errors.terms_accepted && (
          <p className="text-start text-xs text-red-600" role="alert">{form.formState.errors.terms_accepted.message}</p>
        )}
      </section>

      {state?.ok === false && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      )}

      <div className="flex justify-center pt-1">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
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
  );
}
