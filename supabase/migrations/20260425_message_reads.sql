-- ─── 20260425_message_reads.sql — Persist per-user per-thread read receipts ───
-- thread_id TEXT matches buildChannelId() output: 'msg-{coachId}-{athleteId}'
-- Used as offline fallback for useMessageChannel broadcast read events.

CREATE TABLE IF NOT EXISTS public.message_reads (
  thread_id    TEXT        NOT NULL,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

-- Index for coach fetching all read receipts for a thread prefix
CREATE INDEX IF NOT EXISTS idx_message_reads_thread
  ON public.message_reads (thread_id);

-- RLS: users can only read/write their own rows
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_reads_own"
  ON public.message_reads
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Grant to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.message_reads TO authenticated;
