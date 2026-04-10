-- ─────────────────────────────────────────────────────────────────────────────
-- 001_initial_schema.sql
-- Sporeus Athlete Console — initial Supabase schema
-- Run via: Supabase Dashboard → SQL Editor → paste and run
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── ENUMs ────────────────────────────────────────────────────────────────────
create type user_role   as enum ('athlete', 'coach', 'admin');
create type link_status as enum ('pending', 'active', 'revoked');
create type log_source  as enum ('manual', 'fit', 'strava', 'gpx');

-- ─── profiles ─────────────────────────────────────────────────────────────────
-- One row per auth user. Mirrors auth.users via id.
create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text unique not null,
  display_name  text,
  role          user_role not null default 'athlete',
  training_age  text,                        -- e.g. "< 1 year", "3-5 years"
  sport         text,                        -- e.g. "running", "cycling"
  goal          text,                        -- e.g. "marathon sub-4h"
  race_date     date,
  ftp           numeric(6,2),
  vo2max        numeric(5,2),
  lt_pace       text,                        -- "4:45" sec/km string
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function touch_updated_at();

-- ─── training_log ─────────────────────────────────────────────────────────────
create table training_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles on delete cascade,
  date          date not null,
  type          text,                        -- "Easy Run", "Threshold", etc.
  duration_min  numeric(7,2),
  tss           numeric(7,2),
  rpe           numeric(4,2),
  zones         jsonb,                       -- [z1_min, z2_min, z3_min, z4_min, z5_min]
  notes         text,
  source        log_source not null default 'manual',
  external_id   text,                        -- strava activity id, fit file hash, etc.
  created_at    timestamptz not null default now()
);

create index training_log_user_date on training_log (user_id, date desc);
create unique index training_log_external on training_log (user_id, external_id) where external_id is not null;

-- ─── recovery ─────────────────────────────────────────────────────────────────
create table recovery (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles on delete cascade,
  date          date not null,
  score         numeric(5,2),                -- 0-100 subjective readiness
  sleep_hrs     numeric(4,2),
  soreness      smallint check (soreness between 1 and 5),
  stress        smallint check (stress between 1 and 5),
  mood          smallint check (mood between 1 and 5),
  hrv           numeric(6,2),                -- rMSSD in ms
  notes         text,
  created_at    timestamptz not null default now(),
  unique (user_id, date)
);

create index recovery_user_date on recovery (user_id, date desc);

-- ─── injuries ─────────────────────────────────────────────────────────────────
create table injuries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles on delete cascade,
  zone          text not null,               -- "knee", "achilles", etc.
  date          date not null,
  level         smallint check (level between 1 and 5),
  type          text,                        -- "overuse", "acute", "strain"
  notes         text,
  resolved_date date,
  created_at    timestamptz not null default now()
);

create index injuries_user_date on injuries (user_id, date desc);

-- ─── test_results ─────────────────────────────────────────────────────────────
create table test_results (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles on delete cascade,
  date          date not null,
  test_id       text not null,               -- 'cooper','ramp','ftp20','beep','yyir1','wingate','oneRM','astrand'
  value         text not null,               -- stored as text to handle "12:34" format
  unit          text,
  created_at    timestamptz not null default now()
);

create index test_results_user_date on test_results (user_id, date desc);

-- ─── race_results ─────────────────────────────────────────────────────────────
create table race_results (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles on delete cascade,
  date          date not null,
  distance_m    numeric(10,2),               -- in meters
  goal_time_s   integer,                     -- in seconds
  predicted_s   integer,
  actual_s      integer,
  conditions    text,                        -- "hot", "cold", "windy", "trail"
  notes         text,
  created_at    timestamptz not null default now()
);

create index race_results_user_date on race_results (user_id, date desc);

-- ─── coach_athletes ───────────────────────────────────────────────────────────
create table coach_athletes (
  coach_id      uuid not null references profiles on delete cascade,
  athlete_id    uuid not null references profiles on delete cascade,
  status        link_status not null default 'pending',
  invite_token  text unique,                 -- used in invite link ?coach=TOKEN
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key   (coach_id, athlete_id)
);

create trigger coach_athletes_updated_at
  before update on coach_athletes
  for each row execute function touch_updated_at();

create index coach_athletes_athlete on coach_athletes (athlete_id, status);

-- ─── coach_notes ──────────────────────────────────────────────────────────────
create table coach_notes (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references profiles on delete cascade,
  athlete_id    uuid not null references profiles on delete cascade,
  note          text not null,
  created_at    timestamptz not null default now()
);

create index coach_notes_pair on coach_notes (coach_id, athlete_id, created_at desc);

-- ─── strava_tokens (Phase 3) ─────────────────────────────────────────────────
create table strava_tokens (
  user_id       uuid primary key references profiles on delete cascade,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  strava_athlete_id bigint,
  last_sync_at  timestamptz,
  updated_at    timestamptz not null default now()
);

-- ─── push_subscriptions (Phase 3.4) ──────────────────────────────────────────
create table push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles on delete cascade,
  endpoint      text not null unique,
  keys          jsonb,                       -- {p256dh, auth}
  created_at    timestamptz not null default now()
);

-- ═════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═════════════════════════════════════════════════════════════════════════════

alter table profiles         enable row level security;
alter table training_log     enable row level security;
alter table recovery         enable row level security;
alter table injuries         enable row level security;
alter table test_results     enable row level security;
alter table race_results     enable row level security;
alter table coach_athletes   enable row level security;
alter table coach_notes      enable row level security;
alter table strava_tokens    enable row level security;
alter table push_subscriptions enable row level security;

-- ── profiles ──────────────────────────────────────────────────────────────────
create policy "profiles: own row"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- coaches can read profiles of their active athletes
create policy "profiles: coaches read athletes"
  on profiles for select
  using (
    exists (
      select 1 from coach_athletes ca
      where ca.coach_id = auth.uid()
        and ca.athlete_id = profiles.id
        and ca.status = 'active'
    )
  );

-- ── training_log ──────────────────────────────────────────────────────────────
create policy "training_log: own rows"
  on training_log for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "training_log: coaches read athletes"
  on training_log for select
  using (
    exists (
      select 1 from coach_athletes ca
      where ca.coach_id = auth.uid()
        and ca.athlete_id = training_log.user_id
        and ca.status = 'active'
    )
  );

-- ── recovery ──────────────────────────────────────────────────────────────────
create policy "recovery: own rows"
  on recovery for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "recovery: coaches read athletes"
  on recovery for select
  using (
    exists (
      select 1 from coach_athletes ca
      where ca.coach_id = auth.uid()
        and ca.athlete_id = recovery.user_id
        and ca.status = 'active'
    )
  );

-- ── injuries ──────────────────────────────────────────────────────────────────
create policy "injuries: own rows"
  on injuries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "injuries: coaches read athletes"
  on injuries for select
  using (
    exists (
      select 1 from coach_athletes ca
      where ca.coach_id = auth.uid()
        and ca.athlete_id = injuries.user_id
        and ca.status = 'active'
    )
  );

-- ── test_results ──────────────────────────────────────────────────────────────
create policy "test_results: own rows"
  on test_results for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "test_results: coaches read athletes"
  on test_results for select
  using (
    exists (
      select 1 from coach_athletes ca
      where ca.coach_id = auth.uid()
        and ca.athlete_id = test_results.user_id
        and ca.status = 'active'
    )
  );

-- ── race_results ──────────────────────────────────────────────────────────────
create policy "race_results: own rows"
  on race_results for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "race_results: coaches read athletes"
  on race_results for select
  using (
    exists (
      select 1 from coach_athletes ca
      where ca.coach_id = auth.uid()
        and ca.athlete_id = race_results.user_id
        and ca.status = 'active'
    )
  );

-- ── coach_athletes ────────────────────────────────────────────────────────────
-- coaches see their own records; athletes see their own coach link
create policy "coach_athletes: coach or athlete"
  on coach_athletes for all
  using (auth.uid() = coach_id or auth.uid() = athlete_id)
  with check (auth.uid() = coach_id or auth.uid() = athlete_id);

-- ── coach_notes ───────────────────────────────────────────────────────────────
create policy "coach_notes: coach writes, athlete reads own"
  on coach_notes for all
  using (
    auth.uid() = coach_id
    or (auth.uid() = athlete_id and pg_has_role(auth.uid()::text, 'authenticated', 'member'))
  )
  with check (auth.uid() = coach_id);

-- ── strava_tokens ─────────────────────────────────────────────────────────────
create policy "strava_tokens: own row"
  on strava_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── push_subscriptions ────────────────────────────────────────────────────────
create policy "push_subscriptions: own rows"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
