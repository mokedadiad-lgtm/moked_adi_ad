-- מצב ריצות Cron לפושים תקופתיים (למשל סיכום שאלות שני/חמישי)
create table if not exists public.push_digest_checkpoints (
  key text primary key,
  last_checkpoint_at timestamptz not null,
  updated_at timestamptz not null default now()
);

comment on table public.push_digest_checkpoints is
  'שומר חותמות זמן לריצות cron של פוש דיג׳סטים';

comment on column public.push_digest_checkpoints.key is
  'מזהה לוגי לדיג׳סט (למשל questions_monday_thursday)';

comment on column public.push_digest_checkpoints.last_checkpoint_at is
  'הזמן האחרון שעד אליו נספרו פריטים בדיג׳סט';

alter table public.push_digest_checkpoints enable row level security;
-- ללא policies: גישה דרך service role בלבד.
