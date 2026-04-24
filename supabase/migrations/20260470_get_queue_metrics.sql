-- Queue health metrics for ObservabilityDashboard pgmq panel
CREATE OR REPLACE FUNCTION public.get_queue_metrics()
RETURNS TABLE (
  queue_name         text,
  msg_count          bigint,
  oldest_msg_age_sec bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.queue_name::text,
    m.msg_count::bigint,
    COALESCE(EXTRACT(EPOCH FROM (now() - m.newest_msg_age_sec))::bigint, 0)
  FROM pgmq.metrics() m
  ORDER BY m.queue_name;
EXCEPTION WHEN OTHERS THEN
  -- pgmq.metrics() not available; return empty
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_queue_metrics() TO service_role;
