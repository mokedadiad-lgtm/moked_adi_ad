-- כותרת לשאלה (ממולא בטופס הראשוני)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS title TEXT;

COMMENT ON COLUMN questions.title IS 'כותרת השאלה כפי שהזין השואל בטופס';
