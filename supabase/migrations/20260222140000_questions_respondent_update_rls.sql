-- Allow respondent to update their assigned question: save draft or submit to proofreading.
-- WITH CHECK explicitly allows the row to move to in_proofreading_lobby.
DROP POLICY IF EXISTS questions_respondent_update ON questions;
CREATE POLICY questions_respondent_update ON questions
  FOR UPDATE TO authenticated
  USING (
    assigned_respondent_id = auth.uid()
    AND stage = 'with_respondent'
  )
  WITH CHECK (
    assigned_respondent_id = auth.uid()
    AND (stage = 'with_respondent' OR stage = 'in_proofreading_lobby')
  );
