-- Soft delete: questions moved to trash have deleted_at set
ALTER TABLE questions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_questions_deleted_at ON questions(deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN questions.deleted_at IS 'When set, question is in trash (אשפה)';
