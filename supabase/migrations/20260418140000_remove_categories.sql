-- הסרת מערכת הקטגוריות (הלכה/ייעוץ/וכו'); סיווג השאלות נשען על נושאים (topics) בלבד.

DROP TRIGGER IF EXISTS questions_sync_archive ON public.questions;

CREATE OR REPLACE FUNCTION public.sync_to_archives()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage = 'sent_archived' AND (OLD.stage IS NULL OR OLD.stage <> 'sent_archived') THEN
    INSERT INTO public.archives (question_id, content, response_text, sent_at)
    VALUES (
      NEW.id,
      NEW.content,
      COALESCE(NEW.response_text, ''),
      COALESCE(NEW.sent_at, now())
    )
    ON CONFLICT (question_id) DO UPDATE SET
      content = EXCLUDED.content,
      response_text = EXCLUDED.response_text,
      sent_at = EXCLUDED.sent_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questions_sync_archive
  AFTER INSERT OR UPDATE OF stage ON public.questions
  FOR EACH ROW EXECUTE PROCEDURE public.sync_to_archives();

DROP INDEX IF EXISTS public.idx_archives_category_slug;
ALTER TABLE public.archives DROP COLUMN IF EXISTS category_slug;

ALTER TABLE public.questions DROP COLUMN IF EXISTS category_id;

DROP TABLE IF EXISTS public.profile_categories;
DROP TABLE IF EXISTS public.categories;
