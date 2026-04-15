-- WhatsApp Inbox media support (image/audio/document)
-- Adds media metadata columns to inbound messages.

alter table public.whatsapp_inbound_messages
  add column if not exists media_id text,
  add column if not exists media_mime_type text,
  add column if not exists media_file_name text,
  add column if not exists media_storage_path text,
  add column if not exists media_caption text,
  add column if not exists media_sha256 text,
  add column if not exists media_size_bytes bigint;

create index if not exists idx_whatsapp_inbound_media_id
  on public.whatsapp_inbound_messages (media_id)
  where media_id is not null;

create index if not exists idx_whatsapp_inbound_media_storage_path
  on public.whatsapp_inbound_messages (media_storage_path)
  where media_storage_path is not null;

comment on column public.whatsapp_inbound_messages.media_id is
  'Meta media id (image/audio/document) if present';
comment on column public.whatsapp_inbound_messages.media_mime_type is
  'Inbound media MIME type';
comment on column public.whatsapp_inbound_messages.media_file_name is
  'Inbound document filename (when relevant)';
comment on column public.whatsapp_inbound_messages.media_storage_path is
  'Supabase storage path for downloaded inbound media';
comment on column public.whatsapp_inbound_messages.media_caption is
  'Caption for image/document when provided';
comment on column public.whatsapp_inbound_messages.media_sha256 is
  'SHA-256 provided by Meta for media when provided';
comment on column public.whatsapp_inbound_messages.media_size_bytes is
  'Media size in bytes (from Meta metadata or download response)';
