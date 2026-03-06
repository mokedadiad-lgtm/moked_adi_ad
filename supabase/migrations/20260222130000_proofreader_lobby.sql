-- Lobby: proofreader_note for "Return to Admin", and RLS so proofreader can see claimed + claim/release/return.

-- 1. Note when proofreader returns task to admin
ALTER TABLE questions ADD COLUMN IF NOT EXISTS proofreader_note TEXT;

-- 2. Proofreader can SELECT questions in lobby that they claimed (migration 20260222110000 only allows unclaimed)
DROP POLICY IF EXISTS questions_proofreader_claimed ON questions;
CREATE POLICY questions_proofreader_claimed ON questions
  FOR SELECT TO authenticated
  USING (
    stage = 'in_proofreading_lobby'
    AND assigned_proofreader_id = auth.uid()
    AND (SELECT (my_profile()).is_proofreader)
  );

-- 3. Proofreader can UPDATE to CLAIM (set assigned_proofreader_id from NULL to self)
DROP POLICY IF EXISTS questions_proofreader_claim ON questions;
CREATE POLICY questions_proofreader_claim ON questions
  FOR UPDATE TO authenticated
  USING (
    stage = 'in_proofreading_lobby'
    AND assigned_proofreader_id IS NULL
    AND questions.proofreader_type_id IS NOT NULL
    AND questions.proofreader_type_id = (SELECT proofreader_type_id FROM profiles WHERE id = auth.uid())
    AND (SELECT (my_profile()).is_proofreader)
  )
  WITH CHECK (assigned_proofreader_id = auth.uid());

-- 4. Proofreader can UPDATE their claimed task: release (null) or return to admin (stage + note)
DROP POLICY IF EXISTS questions_update_proofreader ON questions;
CREATE POLICY questions_update_proofreader ON questions
  FOR UPDATE TO authenticated
  USING (
    stage = 'in_proofreading_lobby'
    AND assigned_proofreader_id = auth.uid()
    AND (SELECT (my_profile()).is_proofreader)
  )
  WITH CHECK (
    assigned_proofreader_id = auth.uid() OR assigned_proofreader_id IS NULL
  );
