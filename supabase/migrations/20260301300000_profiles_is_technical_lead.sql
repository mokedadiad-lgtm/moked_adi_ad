-- Add technical lead role to profiles (אחראי טכני)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_technical_lead BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN profiles.is_technical_lead IS 'אחראי טכני';
