-- v9.405 — drop the orphaned profiles.training_age column.
--
-- It was write-only/dead: the app's training age lives in localStorage
-- 'sporeus-training-age' (TrainingAgeCard + levelFromTrainingAge); the only writer was
-- dataMigration.js (guest→account), which never had a reader. Verified before dropping:
--   * no client/edge read (grep src/ + supabase/functions/),
--   * no DB function/view/policy reference, no index/constraint,
--   * 0 of 8 prod rows populated → no data loss.
-- The dead write in dataMigration.js is removed in the same change (v9.405).
alter table public.profiles drop column if exists training_age;
