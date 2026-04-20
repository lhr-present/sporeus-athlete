-- sql_smoke_cleanup.sql — Remove CI test data seeded by sql_smoke_seed.sql
-- Called in always() CI step so data is cleaned up even if assertions fail.

DELETE FROM public.session_comments WHERE id='ffffffff-0000-4000-8000-000000000001';
DELETE FROM public.session_views    WHERE user_id  IN ('dddddddd-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000002','dddddddd-0000-4000-8000-000000000003');
DELETE FROM public.coach_athletes   WHERE coach_id ='dddddddd-0000-4000-8000-000000000001' AND athlete_id='dddddddd-0000-4000-8000-000000000002';
DELETE FROM public.training_log     WHERE id       ='eeeeeeee-0000-4000-8000-000000000001';
DELETE FROM public.profiles         WHERE id IN    ('dddddddd-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000002','dddddddd-0000-4000-8000-000000000003');
DELETE FROM auth.users              WHERE id IN    ('dddddddd-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000002','dddddddd-0000-4000-8000-000000000003');

SELECT 'cleanup_ok' AS result;
