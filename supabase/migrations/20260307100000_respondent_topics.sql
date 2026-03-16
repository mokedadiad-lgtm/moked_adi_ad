-- שיוך נושאים למשיבים: אילו משיבים יכולים לקבל שאלות באילו נושאים (topics)
CREATE TABLE IF NOT EXISTS respondent_topics (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id   UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_respondent_topics_profile ON respondent_topics(profile_id);
CREATE INDEX IF NOT EXISTS idx_respondent_topics_topic ON respondent_topics(topic_id);

ALTER TABLE respondent_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS respondent_topics_select ON respondent_topics;
CREATE POLICY respondent_topics_select ON respondent_topics
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS respondent_topics_manage ON respondent_topics;
CREATE POLICY respondent_topics_manage ON respondent_topics
  FOR ALL TO authenticated
  USING ((SELECT (my_profile()).is_admin) OR (SELECT (my_profile()).is_technical_lead))
  WITH CHECK ((SELECT (my_profile()).is_admin) OR (SELECT (my_profile()).is_technical_lead));

COMMENT ON TABLE respondent_topics IS 'שיוך נושאים למשיבים – אילו משיבים מטפלים באילו נושאים';
