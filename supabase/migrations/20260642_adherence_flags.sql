-- 20260642_adherence_flags.sql — adherence flags cross-device (v9.485)
--
-- Contract sweep E1: restDayMarked / sickDay / correctiveRest /
-- improvisedSession / plannedType are whitelisted client-side (each carries a
-- distinct adherence signal, v9.152) but were never persisted — signed-in
-- users lost them on every reload. One jsonb column, packed/unpacked by the
-- mappers; only truthy flags are stored (null when none).

ALTER TABLE public.training_log
  ADD COLUMN IF NOT EXISTS flags jsonb;

COMMENT ON COLUMN public.training_log.flags IS
  'Adherence flags {restDayMarked,sickDay,correctiveRest,improvisedSession,plannedType} — packed by logEntryToRow, only truthy members stored.';
