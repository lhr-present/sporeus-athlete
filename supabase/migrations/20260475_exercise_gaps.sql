-- 20260475_exercise_gaps.sql
-- View: last date each user performed each exercise. Used for gap-aware load suggestions.
CREATE OR REPLACE VIEW exercise_last_seen AS
  SELECT
    s.user_id,
    st.exercise_id,
    MAX(s.session_date) AS last_seen_date
  FROM strength_sessions s
  JOIN strength_sets st ON st.session_id = s.id
  GROUP BY s.user_id, st.exercise_id;

GRANT SELECT ON exercise_last_seen TO authenticated;
