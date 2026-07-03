-- 20260637_training_log_enrichment.sql — P0 Strava data enrichment columns
--
-- QW1–QW4 of docs/audits/strava_data_enhancements_2026_07_03.md: the Strava
-- summary payload already carries power/elevation/effort/clock-time fields the
-- edge mappers dropped. These columns receive them (written by the shared
-- _shared/stravaActivity.ts mapper; hydrated by logRowToEntry). The FIT-upload
-- path may adopt the same columns later (parse-activity already writes
-- decoupling_pct + computes np).
--
-- avg_power / np / kilojoules are ONLY written when Strava's device_watts=true
-- (real power meter / erg — never Strava's estimated power).
-- rpe_method records how a non-null rpe was obtained ('derived_hr',
-- 'derived_suffer'; athlete-entered values keep NULL method) so estimates are
-- never presented as reported effort.

ALTER TABLE public.training_log
  ADD COLUMN IF NOT EXISTS max_hr           integer,
  ADD COLUMN IF NOT EXISTS avg_power        integer,
  ADD COLUMN IF NOT EXISTS np               integer,
  ADD COLUMN IF NOT EXISTS kilojoules       integer,
  ADD COLUMN IF NOT EXISTS elevation_gain_m integer,
  ADD COLUMN IF NOT EXISTS suffer_score     integer,
  ADD COLUMN IF NOT EXISTS start_time       text,
  ADD COLUMN IF NOT EXISTS rpe_method       text;

COMMENT ON COLUMN public.training_log.np IS
  'Normalized Power (W). Strava: weighted_average_watts, device_watts-gated. FIT: computed by parse-activity/fileImport.';
COMMENT ON COLUMN public.training_log.rpe_method IS
  'How rpe was obtained: derived_hr (%HRmax bands), derived_suffer (suffer-score/h). NULL = athlete-entered or rpe is NULL.';
COMMENT ON COLUMN public.training_log.start_time IS
  'Session local clock time HH:MM (from Strava start_date_local) — feeds timeOfDayConsistency.';
