-- ─── 002_coach_invites.sql ────────────────────────────────────────────────────
-- Short-lived invite codes coaches share with athletes to link accounts.

create table if not exists coach_invites (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references profiles(id) on delete cascade,
  code       text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by    uuid references profiles(id) default null
);

create index if not exists coach_invites_code on coach_invites (code);
create index if not exists coach_invites_coach on coach_invites (coach_id, created_at desc);

alter table coach_invites enable row level security;

-- Coach can manage their own invites
create policy "coach_invites: coach manages own"
  on coach_invites for all
  using  (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

-- Any authenticated athlete can read an active invite by code (to accept it)
create policy "coach_invites: athlete reads active"
  on coach_invites for select
  using (used_by is null and expires_at > now());
