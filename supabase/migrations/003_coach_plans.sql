-- ─── 003_coach_plans.sql — Coach-pushed training plans (Phase 3 completion) ──
-- Coaches write plans; athletes read them in their Periodization tab.

create table if not exists coach_plans (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references profiles on delete cascade,
  athlete_id  uuid not null references profiles on delete cascade,
  name        text not null default 'Training Plan',
  goal        text,
  start_date  date not null,
  weeks       jsonb not null default '[]',  -- array from generatePlan()
  status      text not null default 'active' check (status in ('active','archived')),
  created_at  timestamptz not null default now()
);

create index if not exists coach_plans_athlete
  on coach_plans (athlete_id, created_at desc);

create index if not exists coach_plans_coach
  on coach_plans (coach_id, created_at desc);

alter table coach_plans enable row level security;

-- Coach: full CRUD on their own plans
create policy "coach_plans: coach manages"
  on coach_plans for all
  using  (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

-- Athlete: read-only for plans sent to them
create policy "coach_plans: athlete reads"
  on coach_plans for select
  using (auth.uid() = athlete_id);
