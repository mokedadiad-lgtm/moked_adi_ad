-- WhatsApp Inbox + Bot conversation state
-- Meta WhatsApp Cloud API webhook will log inbound events here (service role).

-- Conversation mode: either handled by bot FSM or routed to human inbox.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_conversation_mode') THEN
    CREATE TYPE whatsapp_conversation_mode AS ENUM ('bot', 'human');
  END IF;
END $$;

-- Bot FSM state: keep as TEXT to allow iterative rollout without enum churn.
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone            TEXT NOT NULL UNIQUE,
  mode             whatsapp_conversation_mode NOT NULL DEFAULT 'bot',
  state            TEXT NOT NULL DEFAULT 'start',
  context          JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_inbound_at  TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  unread_count     INT NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  assigned_admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_mode ON whatsapp_conversations(mode);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_inbound_at ON whatsapp_conversations(last_inbound_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_updated_at ON whatsapp_conversations(updated_at DESC);

-- Inbound message/event log (idempotency key = provider_message_id)
CREATE TABLE IF NOT EXISTS whatsapp_inbound_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            TEXT NOT NULL DEFAULT 'meta',
  provider_message_id TEXT NOT NULL,
  conversation_id     UUID REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  from_phone          TEXT NOT NULL,
  message_type        TEXT,
  text_body           TEXT,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at        TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'received', -- received|processed|ignored|error
  error               TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_inbound_provider_message_id
  ON whatsapp_inbound_messages(provider, provider_message_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_conversation_id ON whatsapp_inbound_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_from_phone ON whatsapp_inbound_messages(from_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_received_at ON whatsapp_inbound_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_status ON whatsapp_inbound_messages(status);

-- Outbound message log + queue (idempotency per app-level key)
CREATE TABLE IF NOT EXISTS whatsapp_outbound_messages (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider             TEXT NOT NULL DEFAULT 'meta',
  conversation_id      UUID REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  to_phone             TEXT NOT NULL,
  channel_event        TEXT NOT NULL, -- e.g. bot_prompt, assignment, reminder, asker_pdf
  idempotency_key      TEXT,
  payload              JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_message_id  TEXT,
  status               TEXT NOT NULL DEFAULT 'queued', -- queued|sent|error
  retry_count          INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_attempt_at      TIMESTAMPTZ,
  error                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_outbound_idempotency
  ON whatsapp_outbound_messages(provider, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_status ON whatsapp_outbound_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_created_at ON whatsapp_outbound_messages(created_at DESC);

-- updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'whatsapp_conversations_updated_at') THEN
    CREATE TRIGGER whatsapp_conversations_updated_at
      BEFORE UPDATE ON whatsapp_conversations
      FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'whatsapp_outbound_messages_updated_at') THEN
    CREATE TRIGGER whatsapp_outbound_messages_updated_at
      BEFORE UPDATE ON whatsapp_outbound_messages
      FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
  END IF;
END $$;

-- RLS (admin-only; webhook processing uses service role)
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_inbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_outbound_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_conversations_admin_all
  ON whatsapp_conversations
  FOR ALL TO authenticated
  USING ((SELECT (my_profile()).is_admin))
  WITH CHECK ((SELECT (my_profile()).is_admin));

CREATE POLICY whatsapp_inbound_messages_admin_all
  ON whatsapp_inbound_messages
  FOR ALL TO authenticated
  USING ((SELECT (my_profile()).is_admin))
  WITH CHECK ((SELECT (my_profile()).is_admin));

CREATE POLICY whatsapp_outbound_messages_admin_all
  ON whatsapp_outbound_messages
  FOR ALL TO authenticated
  USING ((SELECT (my_profile()).is_admin))
  WITH CHECK ((SELECT (my_profile()).is_admin));

COMMENT ON TABLE whatsapp_conversations IS 'WhatsApp conversations keyed by phone; holds bot FSM state and human handoff mode.';
COMMENT ON TABLE whatsapp_inbound_messages IS 'Inbound WhatsApp events/messages (idempotent by provider_message_id).';
COMMENT ON TABLE whatsapp_outbound_messages IS 'Outbound WhatsApp send log/queue with retries and idempotency.';

