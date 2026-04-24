-- Add label column to api_keys (was missing from original schema)
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS label text;

-- generate_api_key: creates a new api_key row and returns the full key (shown once)
CREATE OR REPLACE FUNCTION public.generate_api_key(p_label text, p_org_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text;
BEGIN
  -- Generate a readable key: sk-<uuid without hyphens>
  v_key := 'sk-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.api_keys (api_key, org_id, label, tier, created_at)
  VALUES (v_key, p_org_id, p_label, 'club', now());

  RETURN v_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_api_key(text, uuid) TO service_role;
