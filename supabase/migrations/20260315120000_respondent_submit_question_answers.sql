-- Respondent submit: update question_answers when assignment is there, else questions (legacy).
DROP FUNCTION IF EXISTS submit_respondent_response(uuid, uuid, text);

CREATE OR REPLACE FUNCTION submit_respondent_response(
  p_proofreader_type_id uuid,
  p_question_id uuid,
  p_response_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'לא מאומת');
  END IF;

  -- Prefer question_answers: if this question has an answer row for this respondent, update it
  UPDATE question_answers
  SET
    response_text = p_response_text,
    stage = 'in_proofreading_lobby',
    proofreader_type_id = p_proofreader_type_id,
    updated_at = now()
  WHERE question_id = p_question_id
    AND assigned_respondent_id = v_uid
    AND stage = 'with_respondent';

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- Legacy: no question_answer row, update questions
  UPDATE questions
  SET
    response_text = p_response_text,
    stage = 'in_proofreading_lobby',
    proofreader_type_id = p_proofreader_type_id,
    updated_at = now()
  WHERE id = p_question_id
    AND assigned_respondent_id = v_uid
    AND stage = 'with_respondent';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'לא נמצא או שאין הרשאה');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_respondent_response(uuid, uuid, text) TO authenticated;
COMMENT ON FUNCTION submit_respondent_response(uuid, uuid, text) IS 'משיב שולח תשובה להגהה; תומך ב-question_answers ו-questions';