-- טפסי הצטרפות צוות (משיב / מגיה) + אישור אדמין

CREATE TABLE team_join_link_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  TEXT NOT NULL UNIQUE,
  form_kind   TEXT NOT NULL CHECK (form_kind IN ('respondent', 'proofreader')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_join_link_tokens_kind ON team_join_link_tokens(form_kind);
CREATE INDEX idx_team_join_link_tokens_active ON team_join_link_tokens(is_active) WHERE is_active = true;

CREATE TABLE team_join_submissions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_token_id        UUID REFERENCES team_join_link_tokens(id) ON DELETE SET NULL,
  form_kind            TEXT NOT NULL CHECK (form_kind IN ('respondent', 'proofreader')),
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  payload              JSONB NOT NULL DEFAULT '{}',
  password_ciphertext  TEXT,
  admin_note           TEXT,
  reviewed_at          TIMESTAMPTZ,
  reviewed_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_join_submissions_status ON team_join_submissions(status);
CREATE INDEX idx_team_join_submissions_created ON team_join_submissions(created_at DESC);

ALTER TABLE team_join_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_join_submissions ENABLE ROW LEVEL SECURITY;

-- אין מדיניות גישה לציבור — רק service role (שרת)

COMMENT ON TABLE team_join_link_tokens IS 'טוקנים להפקת קישורי טפסי הצטרפות צוות';
COMMENT ON TABLE team_join_submissions IS 'בקשות ממתינות לאישור אדמין לפני יצירת משתמש';
