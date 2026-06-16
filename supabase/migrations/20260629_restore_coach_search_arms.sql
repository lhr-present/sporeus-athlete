-- 20260629_restore_coach_search_arms.sql
-- Restore the coach search arms accidentally dropped in v9.327.0 (20260484): that
-- migration flipped search_everything DEFINER->INVOKER, CLAIMED "body unchanged",
-- but rebuilt from a stale 4-arm body, silently reverting the athlete_session arm
-- (20260432) + athlete arm (20260428). Client still has full UI for both kinds.
-- RLS on training_log + profiles already grants coaches read of active athletes, so
-- both arms are INVOKER-safe (no DEFINER needed). profiles.name_tsv was never applied
-- to prod (20260428 drift) -> (re)created here as plain to_tsvector('simple') to match
-- live notes_tsv generation + the arms' plainto_tsquery('simple', q). Body below is the
-- verbatim live function with two RETURN QUERY arms injected.

alter table public.profiles
  add column if not exists name_tsv tsvector
    generated always as (to_tsvector('simple', coalesce(display_name, ''))) stored;

create index if not exists idx_profiles_name_fts on public.profiles using gin (name_tsv);

CREATE OR REPLACE FUNCTION public.search_everything(q text, limit_per_kind integer DEFAULT 10)
 RETURNS TABLE(kind text, record_id text, rank real, snippet text, date_hint text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Training log sessions (own sessions only)
  RETURN QUERY
    SELECT 'session'::text, id::text,
      ts_rank_cd(notes_tsv, plainto_tsquery('simple', q))::real,
      ts_headline('simple', coalesce(notes,''), plainto_tsquery('simple', q), 'MaxWords=12,MinWords=4'),
      date::text
    FROM training_log
    WHERE notes_tsv @@ plainto_tsquery('simple', q) AND user_id = auth.uid()
    ORDER BY 3 DESC LIMIT limit_per_kind;

  -- Coach notes (accessible by coach or athlete)
  RETURN QUERY
    SELECT 'note'::text, id::text,
      ts_rank_cd(body_tsv, plainto_tsquery('simple', q))::real,
      ts_headline('simple', coalesce(note,''), plainto_tsquery('simple', q), 'MaxWords=12,MinWords=4'),
      created_at::date::text
    FROM coach_notes
    WHERE body_tsv @@ plainto_tsquery('simple', q) AND (coach_id = auth.uid() OR athlete_id = auth.uid())
    ORDER BY 3 DESC LIMIT limit_per_kind;

  -- Messages (accessible by either party)
  RETURN QUERY
    SELECT 'message'::text, id::text,
      ts_rank_cd(content_tsv, plainto_tsquery('simple', q))::real,
      ts_headline('simple', coalesce(body,''), plainto_tsquery('simple', q), 'MaxWords=12,MinWords=4'),
      sent_at::date::text
    FROM messages
    WHERE content_tsv @@ plainto_tsquery('simple', q) AND (coach_id = auth.uid() OR athlete_id = auth.uid())
    ORDER BY 3 DESC LIMIT limit_per_kind;

  -- Team announcements (coach sees own; athlete sees linked coach's)
  RETURN QUERY
    SELECT 'announcement'::text, id::text,
      ts_rank_cd(body_tsv, plainto_tsquery('simple', q))::real,
      ts_headline('simple', coalesce(message,''), plainto_tsquery('simple', q), 'MaxWords=12,MinWords=4'),
      created_at::date::text
    FROM team_announcements
    WHERE body_tsv @@ plainto_tsquery('simple', q)
      AND (coach_id = auth.uid() OR EXISTS (
        SELECT 1 FROM coach_athletes ca
        WHERE ca.athlete_id = auth.uid() AND ca.coach_id = team_announcements.coach_id AND ca.status = 'active'
      ))
    ORDER BY 3 DESC LIMIT limit_per_kind;

  -- Athlete sessions (coach searching their active athletes' session notes; RLS on
  -- training_log already grants coach read via coach_athletes, INVOKER-safe).
  RETURN QUERY
    SELECT 'athlete_session'::text, tl.id::text,
      ts_rank_cd(tl.notes_tsv, plainto_tsquery('simple', q))::real,
      ts_headline('simple', coalesce(tl.notes,''), plainto_tsquery('simple', q), 'MaxWords=12,MinWords=4'),
      tl.date::text
    FROM training_log tl
    JOIN coach_athletes ca ON ca.athlete_id = tl.user_id AND ca.coach_id = auth.uid() AND ca.status = 'active'
    WHERE tl.notes_tsv @@ plainto_tsquery('simple', q)
    ORDER BY 3 DESC LIMIT limit_per_kind;

  -- Athletes by name (coach searching their squad; RLS on profiles grants coach read).
  RETURN QUERY
    SELECT 'athlete'::text, p.id::text,
      ts_rank_cd(p.name_tsv, plainto_tsquery('simple', q))::real,
      coalesce(p.display_name,''),
      NULL::text
    FROM profiles p
    JOIN coach_athletes ca ON ca.athlete_id = p.id AND ca.coach_id = auth.uid() AND ca.status = 'active'
    WHERE p.name_tsv @@ plainto_tsquery('simple', q)
    ORDER BY 3 DESC LIMIT limit_per_kind;
END;
$function$;

grant execute on function public.search_everything(text, int) to authenticated;
