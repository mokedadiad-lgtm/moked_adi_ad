-- RPC so respondent can submit to proofreading without being blocked by RLS.
-- Runs with definer rights but checks auth.uid() = assigned_respondent_id.
CREATE OR REPLACE FUNCTION submit_respondent_response(
  p_question_id uuid,
  p_response_text text,
  p_proofreader_type_id uuid
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

-- Allow authenticated users to call (function itself checks respondent)
GRANT EXECUTE ON FUNCTION submit_respondent_response(uuid, text, uuid) TO authenticated;

COMMENT ON FUNCTION submit_respondent_response(uuid, text, uuid) IS 'משיב שולח תשובה להגהה; מאומת לפי assigned_respondent_id';
