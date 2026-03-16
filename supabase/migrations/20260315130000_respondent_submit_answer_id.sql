-- Optional p_answer_id so respondent can submit to a specific question_answer when they have multiple for same question.
DROP FUNCTION IF EXISTS submit_respondent_response(uuid, uuid, text);

CREATE OR REPLACE FUNCTION submit_respondent_response(
  p_proofreader_type_id uuid,
  p_question_id uuid,
  p_response_text text,
  p_answer_id uuid DEFAULT NULL
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

  IF p_answer_id IS NOT NULL THEN
    UPDATE question_answers
    SET
      response_text = p_response_text,
      stage = 'in_proofreading_lobby',
      proofreader_type_id = p_proofreader_type_id,
      updated_at = now()
    WHERE id = p_answer_id
      AND assigned_respondent_id = v_uid
      AND stage = 'with_respondent';
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'לא נמצא או שאין הרשאה');
  END IF;

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

GRANT EXECUTE ON FUNCTION submit_respondent_response(uuid, uuid, text, uuid) TO authenticated;
COMMENT ON FUNCTION submit_respondent_response(uuid, uuid, text, uuid) IS 'משיב שולח תשובה להגהה; p_answer_id אופציונלי לזיהוי תשובה ספציפית';