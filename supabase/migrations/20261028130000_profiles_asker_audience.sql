-- קהל יעד לאיש צוות: מיועד לבחורים / בחורות / גם וגם
CREATE TYPE asker_audience_type AS ENUM ('M', 'F', 'both');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS asker_audience asker_audience_type NOT NULL DEFAULT 'both';

COMMENT ON COLUMN public.profiles.asker_audience IS
  'קהל הפונים שאיש הצוות מיועד אליהם: M=בחורים, F=בחורות, both=גם וגם';
