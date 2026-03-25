-- חתימה ל-PDF (טקסט חופשי, מיושר לשמאל במסמך) — נשמרת ברמת השאלה
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS linguistic_signature text;

COMMENT ON COLUMN public.questions.linguistic_signature IS 'טקסט חתימה ל-PDF (מוצג מיושר לשמאל)';
