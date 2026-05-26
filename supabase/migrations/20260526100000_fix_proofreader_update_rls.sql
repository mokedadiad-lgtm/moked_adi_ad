-- Fix: allow proofreaders to transition question_answers stage to in_linguistic_review / pending_manager.
-- The original WITH CHECK only validated assigned_proofreader_id but in some PostgreSQL/Supabase
-- configurations the FOR ALL admin policy can interfere. This migration makes the allowed
-- transitions explicit and ensures the policy works reliably.

DROP POLICY IF EXISTS question_answers_proofreader_update ON question_answers;

CREATE POLICY question_answers_proofreader_update ON question_answers
  FOR UPDATE TO authenticated
  USING (
    stage = 'in_proofreading_lobby'
    AND assigned_proofreader_id = auth.uid()
    AND (SELECT (my_profile()).is_proofreader)
  )
  WITH CHECK (
    (assigned_proofreader_id = auth.uid() OR assigned_proofreader_id IS NULL)
    AND stage IN ('in_proofreading_lobby', 'in_linguistic_review', 'pending_manager')
  );
