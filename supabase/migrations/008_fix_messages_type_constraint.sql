-- ============================================================
-- 008_fix_messages_type_constraint.sql
-- BUG: El CHECK constraint de messages.type solo permitía
-- 'text' e 'image'. Videos, audios, GIFs y shares fallaban
-- con error 23514 (check constraint violation) aunque el
-- archivo ya estaba subido a Supabase Storage.
-- ============================================================

DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  -- Buscar el constraint existente sobre la columna type
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.messages'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%type%';

  -- Eliminarlo si existe
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.messages DROP CONSTRAINT %I', v_constraint);
    RAISE NOTICE 'Constraint eliminado: %', v_constraint;
  ELSE
    RAISE NOTICE 'No se encontró constraint existente sobre type';
  END IF;
END $$;

-- Agregar el constraint correcto con todos los tipos válidos
ALTER TABLE public.messages
  ADD CONSTRAINT messages_type_check
  CHECK (type IN ('text', 'image', 'video', 'audio', 'gif', 'share'));
