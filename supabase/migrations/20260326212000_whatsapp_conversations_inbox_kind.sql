-- Classify WhatsApp conversations for inbox views:
-- bot_intake | anonymous | team

alter table public.whatsapp_conversations
  add column if not exists inbox_kind text not null default 'bot_intake'
  check (inbox_kind in ('bot_intake', 'anonymous', 'team'));

-- Backfill existing rows conservatively:
-- human mode -> anonymous, bot mode -> bot_intake
update public.whatsapp_conversations
set inbox_kind = case
  when mode = 'human' then 'anonymous'
  else 'bot_intake'
end
where inbox_kind is null
   or inbox_kind not in ('bot_intake', 'anonymous', 'team');

create index if not exists idx_whatsapp_conversations_inbox_kind
  on public.whatsapp_conversations(inbox_kind);

comment on column public.whatsapp_conversations.inbox_kind
  is 'Inbox classification for admin UI: bot_intake | anonymous | team.';

