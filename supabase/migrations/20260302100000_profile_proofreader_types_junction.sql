-- Allow a proofreader to have multiple types (e.g. תוכן + מקצועי).
-- Junction table profile_proofreader_types; keep profiles.proofreader_type_id for primary/display.

-- 1. Junction table
CREATE TABLE IF NOT EXISTS profile_proofreader_types (
  profile_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proofreader_type_id UUID NOT NULL REFERENCES proofreader_types(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, proofreader_type_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_proofreader_types_profile ON profile_proofreader_types(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_proofreader_types_type ON profile_proofreader_types(proofreader_type_id);

-- 2. Backfill: one row per profile that has proofreader_type_id set
INSERT INTO profile_proofreader_types (profile_id, proofreader_type_id)
  SELECT id, proofreader_type_id FROM profiles WHERE proofreader_type_id IS NOT NULL
ON CONFLICT (profile_id, proofreader_type_id) DO NOTHING;

-- 3. Constraint: when is_proofreader, must have proofreader_type_id set (app also writes junction table)
-- (PostgreSQL CHECK cannot use subqueries; junction is enforced in app + we set proofreader_type_id = first type)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS proofreader_type_when_proofreader;
ALTER TABLE profiles ADD CONSTRAINT proofreader_type_when_proofreader CHECK (
  (NOT is_proofreader) OR (is_proofreader AND proofreader_type_id IS NOT NULL)
);

-- 4. RLS
ALTER TABLE profile_proofreader_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_proofreader_types_select ON profile_proofreader_types;
CREATE POLICY profile_proofreader_types_select ON profile_proofreader_types
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR (SELECT (my_profile()).is_admin)
  );

DROP POLICY IF EXISTS profile_proofreader_types_manage ON profile_proofreader_types;
CREATE POLICY profile_proofreader_types_manage ON profile_proofreader_types
  FOR ALL TO authenticated
  USING (
    profile_id = auth.uid() OR (SELECT (my_profile()).is_admin)
  )
  WITH CHECK (
    profile_id = auth.uid() OR (SELECT (my_profile()).is_admin)
  );

-- 5. Lobby: allow claim/select when question type matches profile's type OR any of profile's junction types
DROP POLICY IF EXISTS questions_proofreader_lobby_match ON questions;
CREATE POLICY questions_proofreader_lobby_match ON questions
  FOR SELECT TO authenticated
  USING (
    stage = 'in_proofreading_lobby'
    AND assigned_proofreader_id IS NULL
    AND questions.proofreader_type_id IS NOT NULL
    AND (SELECT (my_profile()).is_proofreader)
    AND (
      questions.proofreader_type_id = (SELECT proofreader_type_id FROM profiles WHERE id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM profile_proofreader_types
        WHERE profile_id = auth.uid() AND proofreader_type_id = questions.proofreader_type_id
      )
    )
  );

DROP POLICY IF EXISTS questions_proofreader_claim ON questions;
CREATE POLICY questions_proofreader_claim ON questions
  FOR UPDATE TO authenticated
  USING (
    stage = 'in_proofreading_lobby'
    AND assigned_proofreader_id IS NULL
    AND questions.proofreader_type_id IS NOT NULL
    AND (SELECT (my_profile()).is_proofreader)
    AND (
      questions.proofreader_type_id = (SELECT proofreader_type_id FROM profiles WHERE id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM profile_proofreader_types
        WHERE profile_id = auth.uid() AND proofreader_type_id = questions.proofreader_type_id
      )
    )
  )
  WITH CHECK (assigned_proofreader_id = auth.uid());

COMMENT ON TABLE profile_proofreader_types IS 'סוגי הגהה שניתן לבחור למגיה/ה (אפשרות לבחור כמה)';
