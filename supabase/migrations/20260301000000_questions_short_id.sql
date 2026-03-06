-- Short display ID for questions: 2 letters + 4 digits (e.g. AB1234)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS question_short_id_seq START 1;

CREATE OR REPLACE FUNCTION set_question_short_id()
RETURNS TRIGGER AS $$
DECLARE
  n bigint;
BEGIN
  IF NEW.short_id IS NOT NULL AND NEW.short_id <> '' THEN
    RETURN NEW;
  END IF;
  n := nextval('question_short_id_seq');
  NEW.short_id := chr(65 + (floor(random() * 26))::int)
    || chr(65 + (floor(random() * 26))::int)
    || lpad(((n - 1) % 10000 + 1)::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS questions_set_short_id ON questions;
CREATE TRIGGER questions_set_short_id
  BEFORE INSERT ON questions
  FOR EACH ROW
  EXECUTE PROCEDURE set_question_short_id();

-- Backfill existing rows (use row number for numeric part)
WITH numbered AS (
  SELECT id, 'QX' || lpad((row_number() OVER (ORDER BY created_at, id))::text, 4, '0') AS sid
  FROM questions
  WHERE short_id IS NULL
)
UPDATE questions q SET short_id = numbered.sid FROM numbered WHERE q.id = numbered.id;

CREATE INDEX IF NOT EXISTS idx_questions_short_id ON questions(short_id);
