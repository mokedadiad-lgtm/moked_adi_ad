-- Form fields for public landing submission
CREATE TYPE response_type AS ENUM ('short', 'detailed');
CREATE TYPE publication_consent AS ENUM ('publish', 'blur', 'none');

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS asker_gender gender_type,
  ADD COLUMN IF NOT EXISTS asker_age TEXT,
  ADD COLUMN IF NOT EXISTS response_type response_type,
  ADD COLUMN IF NOT EXISTS publication_consent publication_consent,
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN questions.asker_gender IS 'מגדר הפונה (לטופס נחיתה)';
COMMENT ON COLUMN questions.response_type IS 'קצר ולעניין / מפורט';
COMMENT ON COLUMN questions.publication_consent IS 'מסכימה לפרסם / בטשטוש / לא לפרסום';
