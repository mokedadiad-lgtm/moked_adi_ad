-- WhatsApp intake drafts: store asker age as free-text (age range labels),
-- aligned with questions.asker_age (TEXT). Existing numeric ages remain as text digits.

ALTER TABLE public.question_intake_drafts
  ALTER COLUMN asker_age TYPE TEXT USING (
    CASE
      WHEN asker_age IS NULL THEN NULL
      ELSE asker_age::TEXT
    END
  );
