-- 20260481_drop_coach_messages_and_publish_messages.sql
-- v9.134.0 — Corrective rollback of v9.133.0.
--
-- v9.133 shipped a duplicate coach_messages table, unaware that the
-- public.messages table + db/messages.js + CoachMessage.jsx already
-- provided coach<->athlete messaging. CLAUDE.md's "Known Limitations"
-- line claiming messaging was file-based JSON was stale documentation.
--
-- This migration:
--   1. Drops the duplicate coach_messages table (verified empty).
--   2. Adds the REAL messages table to supabase_realtime — which it
--      should have been all along. CoachMessage.jsx's subscribeToMessages
--      has been silently no-op'ing since the realtime feature shipped.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'coach_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.coach_messages;
  END IF;
END $$;

DROP TABLE IF EXISTS public.coach_messages;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
