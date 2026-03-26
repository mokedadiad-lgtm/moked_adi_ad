-- השתקה ללא הגבלת זמן (עד ביטול ידני)
alter table public.profiles
  add column if not exists push_notifications_muted_forever boolean not null default false;

comment on column public.profiles.push_notifications_muted_forever is
  'אם true — לא לשלוח Web Push עד לביטול (בנוסף ל־push_notifications_muted_until)';
