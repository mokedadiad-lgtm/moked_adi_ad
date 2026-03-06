-- טוקן הורדה לשואל: מונע גישה ל-PDF רק עם ניחוש מזהה שאלה
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS asker_download_token TEXT,
  ADD COLUMN IF NOT EXISTS asker_download_token_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_asker_download_token
  ON questions(asker_download_token) WHERE asker_download_token IS NOT NULL;

COMMENT ON COLUMN questions.asker_download_token IS 'טוקן חד-פעמי/פג תוקף להורדת PDF שנשלח למייל השואל';
COMMENT ON COLUMN questions.asker_download_token_expires_at IS 'תאריך תפוגת הטוקן';
