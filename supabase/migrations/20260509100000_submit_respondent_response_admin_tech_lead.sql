-- מאפשר לאדמין ולמוביל טכני לשלוח תשובה להגהה (כמו המשיב המשובץ),
-- כולל סנכרון questions כשהמשתמש הנוכחי אינו assigned_respondent_id בשורת האב.
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
  v_staff boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'לא מאומת');
  END IF;

  v_staff := COALESCE((SELECT (my_profile()).is_admin), false)
    OR COALESCE((SELECT (my_profile()).is_technical_lead), false);

  IF p_answer_id IS NOT NULL THEN
    UPDATE question_answers
    SET
      response_text = p_response_text,
      stage = 'in_proofreading_lobby',
      proofreader_type_id = p_proofreader_type_id,
      updated_at = now()
    WHERE id = p_answer_id
      AND question_id = p_question_id
      AND stage = 'with_respondent'
      AND (
        assigned_respondent_id = v_uid
        OR v_staff
      );
    IF FOUND THEN
      UPDATE questions
      SET
        stage = 'in_proofreading_lobby',
        proofreader_type_id = p_proofreader_type_id,
        updated_at = now()
      WHERE id = p_question_id
        AND (
          assigned_respondent_id = v_uid
          OR v_staff
        );
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
    AND stage = 'with_respondent'
    AND (
      assigned_respondent_id = v_uid
      OR (
        v_staff
        AND (
          SELECT COUNT(*)::int
          FROM question_answers qa
          WHERE qa.question_id = p_question_id
            AND qa.stage = 'with_respondent'
        ) = 1
      )
    );

  IF FOUND THEN
    UPDATE questions
    SET
      stage = 'in_proofreading_lobby',
      proofreader_type_id = p_proofreader_type_id,
      updated_at = now()
    WHERE id = p_question_id
      AND (
        assigned_respondent_id = v_uid
        OR v_staff
      );
    RETURN jsonb_build_object('ok', true);
  END IF;

  UPDATE questions
  SET
    response_text = p_response_text,
    stage = 'in_proofreading_lobby',
    proofreader_type_id = p_proofreader_type_id,
    updated_at = now()
  WHERE id = p_question_id
    AND stage = 'with_respondent'
    AND (
      assigned_respondent_id = v_uid
      OR v_staff
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'לא נמצא או שאין הרשאה');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION submit_respondent_response(uuid, uuid, text, uuid) IS 'משיב / אדמין / מוביל טכני שולח תשובה להגהה; מסנכרן גם questions.stage';
