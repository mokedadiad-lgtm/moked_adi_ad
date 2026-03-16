-- question_answers: one row per (question + topic + respondent) for multi-topic / multi-respondent flow.
-- When a question has rows here, workflow (stage, respondent, proofreader, response_text) lives on question_answers.
-- When a question has no rows here, legacy single-answer flow uses questions table columns.

CREATE TABLE IF NOT EXISTS question_answers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id             UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  topic_id                UUID REFERENCES topics(id) ON DELETE SET NULL,
  sub_topic_id            UUID REFERENCES sub_topics(id) ON DELETE SET NULL,
  assigned_respondent_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_proofreader_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  proofreader_type_id     UUID REFERENCES proofreader_types(id) ON DELETE SET NULL,
  stage                   question_stage NOT NULL DEFAULT 'waiting_assignment',
  response_text           TEXT,
  proofreader_note        TEXT,
  pdf_url                 TEXT,
  pdf_generated_at        TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_answers_question ON question_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_stage ON question_answers(stage);
CREATE INDEX IF NOT EXISTS idx_question_answers_respondent ON question_answers(assigned_respondent_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_proofreader ON question_answers(assigned_proofreader_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_proofreader_type ON question_answers(proofreader_type_id);

CREATE TRIGGER question_answers_updated_at
  BEFORE UPDATE ON question_answers
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;

-- Admin and technical lead: full access
CREATE POLICY question_answers_admin_all ON question_answers
  FOR ALL TO authenticated
  USING ((SELECT (my_profile()).is_admin) OR (SELECT (my_profile()).is_technical_lead))
  WITH CHECK ((SELECT (my_profile()).is_admin) OR (SELECT (my_profile()).is_technical_lead));

-- Respondent: see and update only their assigned answers (with_respondent)
CREATE POLICY question_answers_respondent_select ON question_answers
  FOR SELECT TO authenticated
  USING (
    stage = 'with_respondent'
    AND assigned_respondent_id = auth.uid()
  );

CREATE POLICY question_answers_respondent_update ON question_answers
  FOR UPDATE TO authenticated
  USING (
    assigned_respondent_id = auth.uid()
    AND stage = 'with_respondent'
  )
  WITH CHECK (
    assigned_respondent_id = auth.uid()
    AND (stage = 'with_respondent' OR stage = 'in_proofreading_lobby')
  );

-- Proofreader: see lobby (unclaimed by type, or claimed by self)
CREATE POLICY question_answers_proofreader_lobby ON question_answers
  FOR SELECT TO authenticated
  USING (
    stage = 'in_proofreading_lobby'
    AND (
      assigned_proofreader_id = auth.uid()
      OR (
        assigned_proofreader_id IS NULL
        AND proofreader_type_id IS NOT NULL
        AND proofreader_type_id = (SELECT proofreader_type_id FROM profiles WHERE id = auth.uid())
        AND (SELECT (my_profile()).is_proofreader)
      )
    )
  );

CREATE POLICY question_answers_proofreader_claim ON question_answers
  FOR UPDATE TO authenticated
  USING (
    stage = 'in_proofreading_lobby'
    AND assigned_proofreader_id IS NULL
    AND proofreader_type_id IS NOT NULL
    AND proofreader_type_id = (SELECT proofreader_type_id FROM profiles WHERE id = auth.uid())
    AND (SELECT (my_profile()).is_proofreader)
  )
  WITH CHECK (assigned_proofreader_id = auth.uid());

CREATE POLICY question_answers_proofreader_update ON question_answers
  FOR UPDATE TO authenticated
  USING (
    stage = 'in_proofreading_lobby'
    AND assigned_proofreader_id = auth.uid()
    AND (SELECT (my_profile()).is_proofreader)
  )
  WITH CHECK (assigned_proofreader_id = auth.uid() OR assigned_proofreader_id IS NULL);

-- Linguistic editor: see in_linguistic_review and ready_for_sending
CREATE POLICY question_answers_linguistic ON question_answers
  FOR SELECT TO authenticated
  USING (
    stage IN ('in_linguistic_review', 'ready_for_sending')
    AND (SELECT (my_profile()).is_linguistic_editor OR (SELECT (my_profile()).is_admin))
  );

COMMENT ON TABLE question_answers IS 'תשובות לשאלה – שורה לכל (שאלה + נושא + משיב); כשקיימות שורות, הזרימה על question_answers';