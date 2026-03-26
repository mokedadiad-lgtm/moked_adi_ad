-- Unread is a single "needs attention" flag per conversation (not one per inbound message).
-- Normalize legacy rows that accumulated +1 per message.
UPDATE public.whatsapp_conversations
SET unread_count = 1,
    updated_at = now()
WHERE unread_count > 1;
