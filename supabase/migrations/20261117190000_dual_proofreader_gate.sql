-- Dual proofreader gate: two fixed proofreaders + per-question reviews

CREATE TABLE IF NOT EXISTS system_dual_proofreaders (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  proofreader_a_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  proofreader_b_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dual_proofreaders_distinct CHECK (
    proofreader_a_id IS NULL OR proofreader_b_id IS NULL OR proofreader_a_id <> proofreader_b_id
  )
);

INSERT INTO system_dual_proofreaders (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE system_dual_proofreaders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dual_proofreaders_select ON system_dual_proofreaders;
CREATE POLICY dual_proofreaders_select ON system_dual_proofreaders
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS dual_proofreaders_admin_update ON system_dual_proofreaders;
CREATE POLICY dual_proofreaders_admin_update ON system_dual_proofreaders
  FOR UPDATE TO authenticated
  USING ((SELECT (my_profile()).is_admin))
  WITH CHECK ((SELECT (my_profile()).is_admin));

CREATE TABLE IF NOT EXISTS question_proofreader_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_id UUID REFERENCES question_answers(id) ON DELETE CASCADE,
  proofreader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('approved', 'noted')),
  note TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT question_proofreader_reviews_unique UNIQUE (question_id, proofreader_id)
);

CREATE INDEX IF NOT EXISTS idx_qpr_question ON question_proofreader_reviews(question_id);
CREATE INDEX IF NOT EXISTS idx_qpr_proofreader ON question_proofreader_reviews(proofreader_id);

ALTER TABLE question_proofreader_reviews ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_dual_proofreader(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM system_dual_proofreaders s
    WHERE s.id = 1 AND (s.proofreader_a_id = uid OR s.proofreader_b_id = uid)
  );
$$;

DROP POLICY IF EXISTS qpr_select ON question_proofreader_reviews;
CREATE POLICY qpr_select ON question_proofreader_reviews
  FOR SELECT TO authenticated
  USING (
    (SELECT (my_profile()).is_admin)
    OR is_dual_proofreader(auth.uid())
    OR proofreader_id = auth.uid()
  );

DROP POLICY IF EXISTS qpr_insert_own ON question_proofreader_reviews;
CREATE POLICY qpr_insert_own ON question_proofreader_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    proofreader_id = auth.uid()
    AND is_dual_proofreader(auth.uid())
  );

DROP POLICY IF EXISTS qpr_update_own ON question_proofreader_reviews;
CREATE POLICY qpr_update_own ON question_proofreader_reviews
  FOR UPDATE TO authenticated
  USING (proofreader_id = auth.uid() AND is_dual_proofreader(auth.uid()))
  WITH CHECK (proofreader_id = auth.uid() AND is_dual_proofreader(auth.uid()));

-- Dual proofreaders can see lobby tasks without claim
DROP POLICY IF EXISTS questions_dual_proofreader_lobby ON questions;
CREATE POLICY questions_dual_proofreader_lobby ON questions
  FOR SELECT TO authenticated
  USING (
    stage = 'in_proofreading_lobby'
    AND is_dual_proofreader(auth.uid())
  );

DROP POLICY IF EXISTS questions_dual_proofreader_update ON questions;
CREATE POLICY questions_dual_proofreader_update ON questions
  FOR UPDATE TO authenticated
  USING (
    stage = 'in_proofreading_lobby'
    AND is_dual_proofreader(auth.uid())
  )
  WITH CHECK (
    stage IN ('in_proofreading_lobby', 'in_linguistic_review')
    AND is_dual_proofreader(auth.uid())
  );

CREATE OR REPLACE FUNCTION complete_proofreader_review(
  p_question_id UUID,
  p_answer_id UUID,
  p_outcome TEXT,
  p_note TEXT DEFAULT NULL,
  p_response_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_cfg system_dual_proofreaders%ROWTYPE;
  v_review_count INT;
  v_moved BOOLEAN := false;
  v_notes TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_outcome NOT IN ('approved', 'noted') THEN
    RAISE EXCEPTION 'invalid outcome';
  END IF;

  IF p_outcome = 'noted' AND (p_note IS NULL OR btrim(p_note) = '') THEN
    RAISE EXCEPTION 'note required';
  END IF;

  SELECT * INTO v_cfg FROM system_dual_proofreaders WHERE id = 1;
  IF v_cfg.proofreader_a_id IS NULL OR v_cfg.proofreader_b_id IS NULL THEN
    RAISE EXCEPTION 'dual proofreaders not configured';
  END IF;

  IF v_uid <> v_cfg.proofreader_a_id AND v_uid <> v_cfg.proofreader_b_id THEN
    RAISE EXCEPTION 'not a dual proofreader';
  END IF;

  IF p_response_text IS NOT NULL THEN
    IF p_answer_id IS NOT NULL THEN
      UPDATE question_answers
      SET response_text = p_response_text, updated_at = now()
      WHERE id = p_answer_id AND question_id = p_question_id AND stage = 'in_proofreading_lobby';
    END IF;
    UPDATE questions
    SET response_text = p_response_text, updated_at = now()
    WHERE id = p_question_id AND stage = 'in_proofreading_lobby';
  END IF;

  INSERT INTO question_proofreader_reviews (question_id, answer_id, proofreader_id, outcome, note)
  VALUES (p_question_id, p_answer_id, v_uid, p_outcome, NULLIF(btrim(COALESCE(p_note, '')), ''))
  ON CONFLICT (question_id, proofreader_id) DO UPDATE
  SET outcome = EXCLUDED.outcome,
      note = EXCLUDED.note,
      answer_id = COALESCE(EXCLUDED.answer_id, question_proofreader_reviews.answer_id),
      completed_at = now();

  SELECT COUNT(*) INTO v_review_count
  FROM question_proofreader_reviews
  WHERE question_id = p_question_id
    AND proofreader_id IN (v_cfg.proofreader_a_id, v_cfg.proofreader_b_id);

  IF v_review_count >= 2 THEN
    SELECT string_agg(
      COALESCE(p.full_name_he, 'מגיהה') || ': ' || COALESCE(r.note, CASE WHEN r.outcome = 'approved' THEN 'אושר' ELSE 'הערה' END),
      E'\n'
      ORDER BY r.completed_at
    )
    INTO v_notes
    FROM question_proofreader_reviews r
    LEFT JOIN profiles p ON p.id = r.proofreader_id
    WHERE r.question_id = p_question_id
      AND r.proofreader_id IN (v_cfg.proofreader_a_id, v_cfg.proofreader_b_id);

    IF p_answer_id IS NOT NULL THEN
      UPDATE question_answers
      SET stage = 'in_linguistic_review',
          proofreader_note = v_notes,
          updated_at = now()
      WHERE id = p_answer_id AND question_id = p_question_id;
    END IF;

    UPDATE questions
    SET stage = 'in_linguistic_review',
        proofreader_note = v_notes,
        updated_at = now()
    WHERE id = p_question_id;

    v_moved := true;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'moved_to_linguistic', v_moved,
    'review_count', v_review_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION complete_proofreader_review(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_dual_proofreader(UUID) TO authenticated;
