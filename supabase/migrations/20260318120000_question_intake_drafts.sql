-- WhatsApp question intake drafts (human-in-the-loop approval)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_intake_draft_status') THEN
    CREATE TYPE question_intake_draft_status AS ENUM ('in_progress', 'waiting_admin_approval', 'approved', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS question_intake_drafts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                   TEXT NOT NULL,
  status                  question_intake_draft_status NOT NULL DEFAULT 'in_progress',

  -- Collected intake fields
  asker_gender            gender_type,
  asker_age               INT,
  title                   TEXT,
  content                 TEXT NOT NULL,
  response_type          response_type,
  publication_consent    publication_consent,
  delivery_preference    communication_preference,
  asker_email             TEXT,
  terms_accepted         BOOLEAN NOT NULL DEFAULT false,

  -- Admin fields
  edit_count              INT NOT NULL DEFAULT 0 CHECK (edit_count >= 0),
  approved_at             TIMESTAMPTZ,
  approved_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admin_note              TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_intake_drafts_status ON question_intake_drafts(status);
CREATE INDEX IF NOT EXISTS idx_question_intake_drafts_phone_created ON question_intake_drafts(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_intake_drafts_approved_at ON question_intake_drafts(approved_at DESC NULLS LAST);

ALTER TABLE question_intake_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY question_intake_drafts_admin_all
  ON question_intake_drafts
  FOR ALL TO authenticated
  USING ((SELECT (my_profile()).is_admin))
  WITH CHECK ((SELECT (my_profile()).is_admin));

COMMENT ON TABLE question_intake_drafts IS 'Drafts collected via WhatsApp bot; only converted into questions after admin approval.';

