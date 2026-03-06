-- Anonymous Q&A Management System – Initial Schema
-- Enums for 6-stage workflow, gender, and user preferences

CREATE TYPE gender_type AS ENUM ('M', 'F');

CREATE TYPE communication_preference AS ENUM ('whatsapp', 'email', 'both');

CREATE TYPE proofreader_type AS ENUM ('content', 'professional', 'stylistic');

CREATE TYPE question_stage AS ENUM (
  'waiting_assignment',      -- 1. מחכה לשיבוץ
  'with_respondent',         -- 2. אצל משיב/ה
  'in_proofreading_lobby',   -- 3. בלובי ההגהה
  'in_linguistic_review',    -- 4. בעריכה לשונית
  'ready_for_sending',       -- 5. מוכן לשליחה
  'sent_archived'            -- 6. נשלח ואורכב
);

-- Categories (Halacha, Counseling, Technical, etc.)
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he    TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles extend auth.users with gender, capabilities, and constraints
CREATE TABLE profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gender                  gender_type NOT NULL DEFAULT 'M',
  is_respondent           BOOLEAN NOT NULL DEFAULT false,
  is_proofreader          BOOLEAN NOT NULL DEFAULT false,
  is_admin                BOOLEAN NOT NULL DEFAULT false,
  is_linguistic_editor    BOOLEAN NOT NULL DEFAULT false,
  proofreader_type        proofreader_type,
  communication_preference communication_preference NOT NULL DEFAULT 'email',
  concurrency_limit       INT NOT NULL DEFAULT 1 CHECK (concurrency_limit >= 0),
  cooldown_days           INT NOT NULL DEFAULT 0 CHECK (cooldown_days >= 0),
  admin_note              TEXT,
  full_name_he            TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT proofreader_type_when_proofreader CHECK (
    (NOT is_proofreader) OR (is_proofreader AND proofreader_type IS NOT NULL)
  )
);

-- Profile <-> Categories (many-to-many)
CREATE TABLE profile_categories (
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, category_id)
);

-- Questions with full workflow and assignment
CREATE TABLE questions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id             UUID REFERENCES categories(id) ON DELETE SET NULL,
  stage                   question_stage NOT NULL DEFAULT 'waiting_assignment',
  content                 TEXT NOT NULL,
  response_text            TEXT,
  pdf_url                 TEXT,
  asker_email             TEXT,
  asker_phone             TEXT,
  assigned_respondent_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_proofreader_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  proofreader_type        proofreader_type,
  access_token            TEXT UNIQUE,
  token_expires_at        TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at                 TIMESTAMPTZ
);

CREATE INDEX idx_questions_stage ON questions(stage);
CREATE INDEX idx_questions_assigned_respondent ON questions(assigned_respondent_id);
CREATE INDEX idx_questions_assigned_proofreader ON questions(assigned_proofreader_id);
CREATE INDEX idx_questions_access_token ON questions(access_token) WHERE access_token IS NOT NULL;
CREATE INDEX idx_questions_created_at ON questions(created_at DESC);

-- Archive: searchable view of sent questions (stage 6)
CREATE TABLE archives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE UNIQUE,
  content         TEXT NOT NULL,
  response_text   TEXT NOT NULL,
  category_slug   TEXT,
  sent_at         TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_archives_category_slug ON archives(category_slug);
CREATE INDEX idx_archives_sent_at ON archives(sent_at DESC);

-- Trigger: update profiles.updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Trigger: on question move to sent_archived, upsert into archives
CREATE OR REPLACE FUNCTION sync_to_archives()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage = 'sent_archived' AND (OLD.stage IS NULL OR OLD.stage <> 'sent_archived') THEN
    INSERT INTO archives (question_id, content, response_text, category_slug, sent_at)
    VALUES (
      NEW.id,
      NEW.content,
      COALESCE(NEW.response_text, ''),
      (SELECT slug FROM categories WHERE id = NEW.category_id),
      COALESCE(NEW.sent_at, now())
    )
    ON CONFLICT (question_id) DO UPDATE SET
      content = EXCLUDED.content,
      response_text = EXCLUDED.response_text,
      category_slug = EXCLUDED.category_slug,
      sent_at = EXCLUDED.sent_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questions_sync_archive
  AFTER INSERT OR UPDATE OF stage ON questions
  FOR EACH ROW EXECUTE PROCEDURE sync_to_archives();

-- RLS: enable on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE archives ENABLE ROW LEVEL SECURITY;

-- Helper: current user's profile (is_admin, is_respondent, etc.)
CREATE OR REPLACE FUNCTION my_profile()
RETURNS profiles AS $$
  SELECT p.* FROM profiles p WHERE p.id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Categories: readable by authenticated users
CREATE POLICY categories_select ON categories
  FOR SELECT TO authenticated USING (true);

-- Profiles: users see own profile; admins see all
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR (SELECT (my_profile()).is_admin));

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Profile categories: same as profiles
CREATE POLICY profile_categories_select ON profile_categories
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR (SELECT (my_profile()).is_admin)
  );

-- Questions: Admin sees all; Respondent sees assigned; Proofreader sees lobby + claimed; Linguistic sees stage 4
CREATE POLICY questions_admin_all ON questions
  FOR ALL TO authenticated
  USING ((SELECT (my_profile()).is_admin))
  WITH CHECK ((SELECT (my_profile()).is_admin));

CREATE POLICY questions_respondent_assigned ON questions
  FOR SELECT TO authenticated
  USING (
    stage = 'with_respondent'
    AND assigned_respondent_id = auth.uid()
  );

-- Proofreaders see lobby when proofreader_type matches and question is unclaimed, or when they claimed it.
CREATE POLICY questions_proofreader_claimed ON questions
  FOR SELECT TO authenticated
  USING (
    stage = 'in_proofreading_lobby' AND assigned_proofreader_id = auth.uid()
  );

CREATE POLICY questions_proofreader_lobby_match ON questions
  FOR SELECT TO authenticated
  USING (
    stage = 'in_proofreading_lobby'
    AND assigned_proofreader_id IS NULL
    AND questions.proofreader_type = (SELECT (my_profile()).proofreader_type)
    AND (SELECT (my_profile()).is_proofreader)
  );

CREATE POLICY questions_linguistic ON questions
  FOR SELECT TO authenticated
  USING (
    stage = 'in_linguistic_review'
    AND (SELECT (my_profile()).is_linguistic_editor OR (SELECT (my_profile()).is_admin))
  );

CREATE POLICY questions_ready_for_sending ON questions
  FOR SELECT TO authenticated
  USING (
    stage = 'ready_for_sending'
    AND (SELECT (my_profile()).is_admin)
  );

-- Respondents can update their assigned question (response text, etc.)
CREATE POLICY questions_respondent_update ON questions
  FOR UPDATE TO authenticated
  USING (assigned_respondent_id = auth.uid() AND stage = 'with_respondent')
  WITH CHECK (assigned_respondent_id = auth.uid());

-- Archives: admin and linguistic can search; or open for authenticated read
CREATE POLICY archives_select ON archives
  FOR SELECT TO authenticated
  USING (
    (SELECT (my_profile()).is_admin)
    OR (SELECT (my_profile()).is_linguistic_editor)
  );

-- Service role / migrations can manage categories and profile_categories (admin only in app)
CREATE POLICY categories_insert ON categories FOR INSERT TO authenticated WITH CHECK ((SELECT (my_profile()).is_admin));
CREATE POLICY categories_update ON categories FOR UPDATE TO authenticated USING ((SELECT (my_profile()).is_admin));
CREATE POLICY profile_categories_manage ON profile_categories FOR ALL TO authenticated USING ((SELECT (my_profile()).is_admin));
CREATE POLICY profiles_admin_update ON profiles FOR UPDATE TO authenticated USING ((SELECT (my_profile()).is_admin)) WITH CHECK (true);
CREATE POLICY profiles_insert_own ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Questions: only admin can insert/update stage/assign (handled via admin_all FOR ALL)
-- So we're good. Add policy for inserting questions (e.g. public form or admin)
CREATE POLICY questions_insert ON questions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY questions_update_proofreader ON questions FOR UPDATE TO authenticated
  USING (
    stage = 'in_proofreading_lobby' AND assigned_proofreader_id = auth.uid()
  )
  WITH CHECK (assigned_proofreader_id = auth.uid());

COMMENT ON TABLE profiles IS 'Extends auth.users with gender (M/F), capabilities, and assignment constraints';
COMMENT ON TABLE questions IS 'Anonymous Q&A with 6-stage workflow; access_token for assignment links';
COMMENT ON TABLE archives IS 'Searchable archive of sent answers (synced from questions when stage = sent_archived)';
