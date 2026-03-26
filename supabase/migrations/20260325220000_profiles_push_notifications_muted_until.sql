-- השתקה זמנית של Web Push (לא שולחים דחיפות עד לתאריך)
alter table public.profiles
  add column if not exists push_notifications_muted_until timestamptz null;

comment on column public.profiles.push_notifications_muted_until is
  'עד מתי לא לשלוח התראות דחיפה לדואר נכנס (אם בעתיד — ממשיכים לשלוח)';
