-- Add phone (WhatsApp) to profiles for team notifications
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN profiles.phone IS 'טלפון לווואטסאפ (להתראות צוות)';
