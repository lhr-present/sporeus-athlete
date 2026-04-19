-- supabase/tests/rls/session_comments.test.sql
-- E11 — pgTAP RLS tests for session_comments and session_views.
-- Run via: psql $DATABASE_URL -f supabase/tests/rls/session_comments.test.sql
-- Or via the RLS harness workflow: .github/workflows/rls-harness.yml
--
-- Test users:
--   coach_uid   = 'aaaaaaaa-0000-4000-8000-000000000001'
--   athlete_uid = 'aaaaaaaa-0000-4000-8000-000000000002'
--   other_uid   = 'aaaaaaaa-0000-4000-8000-000000000003'
-- Test session:
--   session_id  = 'bbbbbbbb-0000-4000-8000-000000000001'  (owned by athlete_uid)
-- Test comment:
--   comment_id  = 'cccccccc-0000-4000-8000-000000000001'  (authored by coach_uid)

BEGIN;
SELECT plan(20);

-- ─── Setup ───────────────────────────────────────────────────────────────────

-- Test user UUIDs
\set coach_uid   '''aaaaaaaa-0000-4000-8000-000000000001'''
\set athlete_uid '''aaaaaaaa-0000-4000-8000-000000000002'''
\set other_uid   '''aaaaaaaa-0000-4000-8000-000000000003'''
\set session_id  '''bbbbbbbb-0000-4000-8000-000000000001'''
\set comment_id  '''cccccccc-0000-4000-8000-000000000001'''

-- Seed auth.users (minimal; no real auth)
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, encrypted_password, created_at, updated_at)
VALUES
  (:coach_uid,   'coach@test.com',   '{}', '{}', 'x', now(), now()),
  (:athlete_uid, 'athlete@test.com', '{}', '{}', 'x', now(), now()),
  (:other_uid,   'other@test.com',   '{}', '{}', 'x', now(), now())
ON CONFLICT DO NOTHING;

-- Seed profiles
INSERT INTO public.profiles (id, email, role)
VALUES
  (:coach_uid,   'coach@test.com',   'coach'),
  (:athlete_uid, 'athlete@test.com', 'athlete'),
  (:other_uid,   'other@test.com',   'athlete')
ON CONFLICT DO NOTHING;

-- Seed coach-athlete link
INSERT INTO public.coach_athletes (coach_id, athlete_id, status)
VALUES (:coach_uid, :athlete_uid, 'active')
ON CONFLICT DO NOTHING;

-- Seed training_log session (owned by athlete)
INSERT INTO public.training_log (id, user_id, date, type)
VALUES (:session_id, :athlete_uid, CURRENT_DATE, 'run')
ON CONFLICT DO NOTHING;

-- Seed a comment by the coach
INSERT INTO public.session_comments (id, session_id, author_id, body)
VALUES (:comment_id, :session_id, :coach_uid, 'Good session!')
ON CONFLICT DO NOTHING;

-- ─── session_comments: SELECT ─────────────────────────────────────────────────

-- Athlete can read comments on their own session
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :athlete_uid)::text, true);

SELECT is(
  (SELECT count(*)::int FROM public.session_comments WHERE id = :comment_id),
  1,
  'athlete can read comments on their own session'
);

-- Coach can read comments on their linked athlete's session
SELECT set_config('request.jwt.claims', json_build_object('sub', :coach_uid)::text, true);

SELECT is(
  (SELECT count(*)::int FROM public.session_comments WHERE id = :comment_id),
  1,
  'coach can read comments on linked athlete session'
);

-- Unlinked user cannot read the comment
SELECT set_config('request.jwt.claims', json_build_object('sub', :other_uid)::text, true);

SELECT is(
  (SELECT count(*)::int FROM public.session_comments WHERE id = :comment_id),
  0,
  'unlinked user cannot see comments on another session'
);

-- ─── session_comments: INSERT ─────────────────────────────────────────────────

-- Athlete can comment on own session
SELECT set_config('request.jwt.claims', json_build_object('sub', :athlete_uid)::text, true);

SELECT lives_ok(
  $$ INSERT INTO public.session_comments (session_id, author_id, body)
     VALUES ('bbbbbbbb-0000-4000-8000-000000000001',
             'aaaaaaaa-0000-4000-8000-000000000002',
             'Looking forward to next week!')
  $$,
  'athlete can insert comment on own session'
);

-- Coach can comment on linked athlete session
SELECT set_config('request.jwt.claims', json_build_object('sub', :coach_uid)::text, true);

SELECT lives_ok(
  $$ INSERT INTO public.session_comments (session_id, author_id, body)
     VALUES ('bbbbbbbb-0000-4000-8000-000000000001',
             'aaaaaaaa-0000-4000-8000-000000000001',
             'Great effort!')
  $$,
  'coach can insert comment on linked athlete session'
);

-- Unlinked user cannot insert
SELECT set_config('request.jwt.claims', json_build_object('sub', :other_uid)::text, true);

SELECT throws_ok(
  $$ INSERT INTO public.session_comments (session_id, author_id, body)
     VALUES ('bbbbbbbb-0000-4000-8000-000000000001',
             'aaaaaaaa-0000-4000-8000-000000000003',
             'Intruder comment')
  $$,
  'P0001',
  NULL,
  'unlinked user cannot insert comment'
);

-- Author cannot spoof another user's author_id
SELECT set_config('request.jwt.claims', json_build_object('sub', :athlete_uid)::text, true);

SELECT throws_ok(
  $$ INSERT INTO public.session_comments (session_id, author_id, body)
     VALUES ('bbbbbbbb-0000-4000-8000-000000000001',
             'aaaaaaaa-0000-4000-8000-000000000001',
             'Fake coach comment')
  $$,
  'P0001',
  NULL,
  'cannot insert with spoofed author_id'
);

-- ─── session_comments: UPDATE ────────────────────────────────────────────────

-- Coach can edit own comment
SELECT set_config('request.jwt.claims', json_build_object('sub', :coach_uid)::text, true);

SELECT lives_ok(
  $$ UPDATE public.session_comments
     SET body = 'Updated: Great session!'
     WHERE id = 'cccccccc-0000-4000-8000-000000000001'
  $$,
  'coach can update own comment'
);

-- Athlete cannot update coach comment
SELECT set_config('request.jwt.claims', json_build_object('sub', :athlete_uid)::text, true);

SELECT is(
  (SELECT count(*)::int FROM public.session_comments
   WHERE id = :comment_id AND body = 'Athlete hijacked this'),
  0,
  'athlete cannot update coach comment (UPDATE invisible via RLS)'
);

-- ─── session_views: SELECT ────────────────────────────────────────────────────

-- Seed a session view by coach
INSERT INTO public.session_views (user_id, session_id, viewed_at)
VALUES (:coach_uid, :session_id, now())
ON CONFLICT DO NOTHING;

-- Athlete can see coach view record (presence awareness)
SELECT set_config('request.jwt.claims', json_build_object('sub', :athlete_uid)::text, true);

SELECT is(
  (SELECT count(*)::int FROM public.session_views
   WHERE user_id = :coach_uid AND session_id = :session_id),
  1,
  'athlete can see coach view record for their session'
);

-- Coach can see own view record
SELECT set_config('request.jwt.claims', json_build_object('sub', :coach_uid)::text, true);

SELECT is(
  (SELECT count(*)::int FROM public.session_views
   WHERE user_id = :coach_uid AND session_id = :session_id),
  1,
  'coach can see own view record'
);

-- Unlinked user cannot see the view record
SELECT set_config('request.jwt.claims', json_build_object('sub', :other_uid)::text, true);

SELECT is(
  (SELECT count(*)::int FROM public.session_views
   WHERE session_id = :session_id),
  0,
  'unlinked user cannot see session_views for another session'
);

-- ─── session_views: INSERT ────────────────────────────────────────────────────

-- Coach can upsert own view
SELECT set_config('request.jwt.claims', json_build_object('sub', :coach_uid)::text, true);

SELECT lives_ok(
  $$ INSERT INTO public.session_views (user_id, session_id, viewed_at)
     VALUES ('aaaaaaaa-0000-4000-8000-000000000001',
             'bbbbbbbb-0000-4000-8000-000000000001',
             now())
     ON CONFLICT (user_id, session_id) DO UPDATE SET viewed_at = EXCLUDED.viewed_at
  $$,
  'coach can upsert own session_views row'
);

-- Athlete cannot insert view record on behalf of coach
SELECT set_config('request.jwt.claims', json_build_object('sub', :athlete_uid)::text, true);

SELECT throws_ok(
  $$ INSERT INTO public.session_views (user_id, session_id, viewed_at)
     VALUES ('aaaaaaaa-0000-4000-8000-000000000001',
             'bbbbbbbb-0000-4000-8000-000000000001',
             now())
  $$,
  'P0001',
  NULL,
  'cannot insert session_views with spoofed user_id'
);

-- ─── Constraint: body length ──────────────────────────────────────────────────

SELECT set_config('request.jwt.claims', json_build_object('sub', :athlete_uid)::text, true);

SELECT throws_ok(
  format(
    $$ INSERT INTO public.session_comments (session_id, author_id, body)
       VALUES ('bbbbbbbb-0000-4000-8000-000000000001',
               'aaaaaaaa-0000-4000-8000-000000000002',
               %L) $$,
    repeat('x', 2001)
  ),
  '23514',
  NULL,
  'body longer than 2000 chars violates check constraint'
);

SELECT throws_ok(
  $$ INSERT INTO public.session_comments (session_id, author_id, body)
     VALUES ('bbbbbbbb-0000-4000-8000-000000000001',
             'aaaaaaaa-0000-4000-8000-000000000002',
             '')
  $$,
  '23514',
  NULL,
  'empty body violates check constraint'
);

SELECT * FROM finish();
ROLLBACK;
