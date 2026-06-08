-- ============================================================
-- 005_messages_audio_duration.sql
-- Agrega audio_duration a messages para que los audios del chat
-- persistan y muestren su duración (en segundos) de forma consistente.
-- ============================================================

alter table public.messages
  add column if not exists audio_duration integer;

comment on column public.messages.audio_duration is
  'Duración del audio adjunto en segundos (NULL para mensajes sin audio).';
