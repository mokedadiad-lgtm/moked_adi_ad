-- Proofreader types (editable), topics and sub-topics for questions and proofreader matching
-- Idempotent: safe to run again if migration failed partway.

-- 1. Proofreader types table (replaces enum for profiles; questions get type from topic)
CREATE TABLE IF NOT EXISTS proofreader_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he    TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO proofreader_types (name_he, slug, sort_order) VALUES
  ('תוכן', 'content', 1),
  ('מקצועי', 'professional', 2),
  ('סגנוני', 'stylistic', 3)
ON CONFLICT (slug) DO NOTHING;

-- 2. Topics: each has one proofreader type (for routing)
CREATE TABLE IF NOT EXISTS topics (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he              TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  proofreader_type_id  UUID NOT NULL REFERENCES proofreader_types(id) ON DELETE RESTRICT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Sub-topics under a topic
CREATE TABLE IF NOT EXISTS sub_topics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id   UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  name_he    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_topics_topic ON sub_topics(topic_id);

-- 3b. Drop policy that depends on profiles.proofreader_type (must be before dropping the column)
DROP POLICY IF EXISTS questions_proofreader_lobby_match ON questions;

-- 4. Profiles: add proofreader_type_id, backfill from enum, then drop enum column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS proofreader_type_id UUID REFERENCES proofreader_types(id) ON DELETE SET NULL;

-- Backfill: map enum to first matching type by slug (no-op if column already dropped)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'proofreader_type'
  ) THEN
    UPDATE profiles p
    SET proofreader_type_id = (SELECT id FROM proofreader_types pt WHERE pt.slug = p.proofreader_type::text LIMIT 1)
    WHERE p.proofreader_type IS NOT NULL;
  END IF;
END $$;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS proofreader_type_when_proofreader;
ALTER TABLE profiles DROP COLUMN IF EXISTS proofreader_type;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS proofreader_type_when_proofreader;
ALTER TABLE profiles ADD CONSTRAINT proofreader_type_when_proofreader CHECK (
  (NOT is_proofreader) OR (is_proofreader AND proofreader_type_id IS NOT NULL)
);

-- 5. Questions: topic, sub_topic, and proofreader_type_id (for lobby match)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS sub_topic_id UUID REFERENCES sub_topics(id) ON DELETE SET NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS proofreader_type_id UUID REFERENCES proofreader_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_proofreader_type ON questions(proofreader_type_id);

ALTER TABLE questions DROP COLUMN IF EXISTS proofreader_type;

-- 6. RLS: proofreader_types, topics, sub_topics
ALTER TABLE proofreader_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proofreader_types_select ON proofreader_types;
CREATE POLICY proofreader_types_select ON proofreader_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS proofreader_types_manage ON proofreader_types;
CREATE POLICY proofreader_types_manage ON proofreader_types FOR ALL TO authenticated
  USING ((SELECT (my_profile()).is_admin)) WITH CHECK ((SELECT (my_profile()).is_admin));

DROP POLICY IF EXISTS topics_select ON topics;
CREATE POLICY topics_select ON topics FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS topics_manage ON topics;
CREATE POLICY topics_manage ON topics FOR ALL TO authenticated
  USING ((SELECT (my_profile()).is_admin)) WITH CHECK ((SELECT (my_profile()).is_admin));

DROP POLICY IF EXISTS sub_topics_select ON sub_topics;
CREATE POLICY sub_topics_select ON sub_topics FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sub_topics_manage ON sub_topics;
CREATE POLICY sub_topics_manage ON sub_topics FOR ALL TO authenticated
  USING ((SELECT (my_profile()).is_admin)) WITH CHECK ((SELECT (my_profile()).is_admin));

-- 7. Recreate RLS: proofreader lobby match by proofreader_type_id
DROP POLICY IF EXISTS questions_proofreader_lobby_match ON questions;
CREATE POLICY questions_proofreader_lobby_match ON questions
  FOR SELECT TO authenticated
  USING (
    stage = 'in_proofreading_lobby'
    AND assigned_proofreader_id IS NULL
    AND questions.proofreader_type_id IS NOT NULL
    AND questions.proofreader_type_id = (SELECT proofreader_type_id FROM profiles WHERE id = auth.uid())
    AND (SELECT (my_profile()).is_proofreader)
  );

COMMENT ON TABLE proofreader_types IS 'סוגי הגהה – ניהול מלא (הוספה/עריכה)';
COMMENT ON TABLE topics IS 'נושאים להגהה – כל נושא משויך לסוג הגהה';
COMMENT ON TABLE sub_topics IS 'תת-נושאים תחת נושא';
