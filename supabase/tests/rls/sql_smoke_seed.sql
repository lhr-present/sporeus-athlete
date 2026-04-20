-- sql_smoke_seed.sql — Seed isolated test data for 7-scenario RLS smoke
-- UUIDs use prefix dd-ci- to make cleanup reliable
-- Called in CI before sql_smoke_assertions.sql; cleaned up by sql_smoke_cleanup.sql

INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data,encrypted_password,created_at,updated_at)
VALUES
  ('dddddddd-0000-4000-8000-000000000001','ci-coach@sporeus.test',   '{}','{}','x',now(),now()),
  ('dddddddd-0000-4000-8000-000000000002','ci-athlete@sporeus.test', '{}','{}','x',now(),now()),
  ('dddddddd-0000-4000-8000-000000000003','ci-other@sporeus.test',   '{}','{}','x',now(),now())
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles(id,email,role)
VALUES
  ('dddddddd-0000-4000-8000-000000000001','ci-coach@sporeus.test',  'coach'),
  ('dddddddd-0000-4000-8000-000000000002','ci-athlete@sporeus.test','athlete'),
  ('dddddddd-0000-4000-8000-000000000003','ci-other@sporeus.test',  'athlete')
ON CONFLICT DO NOTHING;

INSERT INTO public.coach_athletes(coach_id,athlete_id,status)
VALUES('dddddddd-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000002','active')
ON CONFLICT DO NOTHING;

INSERT INTO public.training_log(id,user_id,date,type)
VALUES('eeeeeeee-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000002',CURRENT_DATE,'run')
ON CONFLICT DO NOTHING;

INSERT INTO public.session_comments(id,session_id,author_id,body)
VALUES('ffffffff-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','CI test comment')
ON CONFLICT DO NOTHING;

INSERT INTO public.session_views(user_id,session_id,viewed_at)
VALUES('dddddddd-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001',now())
ON CONFLICT DO NOTHING;

SELECT 'seed_ok' AS result;
