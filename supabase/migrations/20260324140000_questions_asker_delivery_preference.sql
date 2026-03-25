-- How the asker chose to receive the final answer (from WhatsApp bot draft or future sources)
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS asker_delivery_preference communication_preference;

COMMENT ON COLUMN public.questions.asker_delivery_preference IS 'ערוץ קבלת תשובה שנבחר בשאלה (וואטסאפ/מייל/שניהם); NULL = לרוב טפסי נחיתה (מייל בלבד)';

