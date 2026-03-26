-- מנויי Web Push למנהלים (התראות על דואר נכנס WhatsApp)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

create index if not exists push_subscriptions_profile_id_idx
  on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

-- גישה רק דרך service role (API routes); משתמשי קצה לא נכנסים ישירות לטבלה

comment on table public.push_subscriptions is 'Web Push subscriptions for admin inbox notifications';
