-- Soft delete per answer: enable moving a single question_answer to trash
ALTER TABLE question_answers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_question_answers_deleted_at
  ON question_answers(deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN question_answers.deleted_at IS 'When set, this specific answer (question_answers row) is in trash; question itself may still be active.';

