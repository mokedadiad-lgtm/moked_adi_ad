-- היסטוריית עריכות לתשובה: גרסאות קודמות (לצפייה על ידי אחראי מערכת בלבד)

CREATE TABLE IF NOT EXISTS question_response_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  response_text   TEXT NOT NULL,
  edited_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_response_versions_question_id
  ON question_response_versions(question_id);
CREATE INDEX IF NOT EXISTS idx_question_response_versions_created_at
  ON question_response_versions(question_id, created_at DESC);

ALTER TABLE question_response_versions ENABLE ROW LEVEL SECURITY;

-- רק אדמין יכול לראות היסטוריה
DROP POLICY IF EXISTS question_response_versions_admin_select ON question_response_versions;
CREATE POLICY question_response_versions_admin_select ON question_response_versions
  FOR SELECT TO authenticated
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()));

-- המערכת יכולה להכניס גרסאות (טריגר)
DROP POLICY IF EXISTS question_response_versions_insert ON question_response_versions;
CREATE POLICY question_response_versions_insert ON question_response_versions
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- פונקציה: שמירת גרסה לפני עדכון response_text
CREATE OR REPLACE FUNCTION save_response_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.response_text IS DISTINCT FROM NEW.response_text
     AND OLD.response_text IS NOT NULL
     AND trim(OLD.response_text) <> '' THEN
    INSERT INTO question_response_versions (question_id, response_text, edited_by)
    VALUES (OLD.id, OLD.response_text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS questions_save_response_version ON questions;
CREATE TRIGGER questions_save_response_version
  BEFORE UPDATE OF response_text ON questions
  FOR EACH ROW
  EXECUTE FUNCTION save_response_version();

COMMENT ON TABLE question_response_versions IS 'היסטוריית גרסאות תשובה – צפייה לאחראי מערכת בלבד';
