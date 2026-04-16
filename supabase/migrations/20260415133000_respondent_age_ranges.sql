-- טווחי גיל למשיבים: אילו טווחים כל משיב/ה יכול/ה לקבל.
CREATE TABLE IF NOT EXISTS respondent_age_ranges (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  age_range  TEXT NOT NULL CHECK (age_range IN ('23-26', '27-34', '35-40', '41-50', '50+')),
  PRIMARY KEY (profile_id, age_range)
);

CREATE INDEX IF NOT EXISTS idx_respondent_age_ranges_profile ON respondent_age_ranges(profile_id);
CREATE INDEX IF NOT EXISTS idx_respondent_age_ranges_age ON respondent_age_ranges(age_range);

ALTER TABLE respondent_age_ranges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS respondent_age_ranges_select ON respondent_age_ranges;
CREATE POLICY respondent_age_ranges_select ON respondent_age_ranges
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS respondent_age_ranges_manage ON respondent_age_ranges;
CREATE POLICY respondent_age_ranges_manage ON respondent_age_ranges
  FOR ALL TO authenticated
  USING ((SELECT (my_profile()).is_admin) OR (SELECT (my_profile()).is_technical_lead))
  WITH CHECK ((SELECT (my_profile()).is_admin) OR (SELECT (my_profile()).is_technical_lead));

COMMENT ON TABLE respondent_age_ranges IS 'טווחי גיל שמוגדרים למשיב/ה (אפשר לבחור כמה)';
