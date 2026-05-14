-- 20260482_publish_realtime_missing_tables.sql
-- v9.135.0 — Audit follow-up to v9.134.
--
-- v9.134 fixed messages → supabase_realtime. A broader audit revealed
-- 4 more tables that code subscribes to via postgres_changes but
-- weren't in the publication, so the subscriptions silently no-op'd.
--
-- Affected subscriptions:
--   - activity_upload_jobs (UploadActivity.jsx, UPDATE — upload progress)
--   - ai_insights          (useInsightNotifier, INSERT — push notifications)
--   - profiles             (useSubscription, UPDATE — tier change after checkout)
--   - session_attendance   (useSessionAttendance, '*' — group attendance)
--
-- Each gets REPLICA IDENTITY FULL so UPDATE/DELETE payloads carry
-- full row data (postgres default is PK-only).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='activity_upload_jobs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_upload_jobs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='ai_insights') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_insights;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='session_attendance') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_attendance;
  END IF;
END $$;

ALTER TABLE public.activity_upload_jobs REPLICA IDENTITY FULL;
ALTER TABLE public.ai_insights          REPLICA IDENTITY FULL;
ALTER TABLE public.profiles             REPLICA IDENTITY FULL;
ALTER TABLE public.session_attendance   REPLICA IDENTITY FULL;
