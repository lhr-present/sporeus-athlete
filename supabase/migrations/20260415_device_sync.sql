-- ─── Device Sync table (v5.12.0) ─────────────────────────────────────────────
-- Stores open-wearables device registrations per user.
-- Tokens encrypted at rest with pgcrypto using the JWT secret.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS athlete_devices (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  provider     text        NOT NULL,                       -- 'garmin'|'polar'|'suunto'|'coros'|'wahoo'|'oura'|'whoop'|'other'
  label        text        NOT NULL DEFAULT '',            -- user-supplied nickname
  base_url     text        NOT NULL,                       -- open-wearables instance URL
  token_enc    bytea,                                      -- pgp_sym_encrypt(token, jwt_secret)
  last_sync_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE athlete_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own devices" ON athlete_devices
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Helper: encrypt token (call from edge function via rpc)
CREATE OR REPLACE FUNCTION encrypt_device_token(plain text)
RETURNS bytea LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN pgp_sym_encrypt(
    plain,
    current_setting('app.settings.jwt_secret', true)
  );
END;
$$;

-- Helper: decrypt token (call from edge function via rpc)
CREATE OR REPLACE FUNCTION decrypt_device_token(enc bytea)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    enc,
    current_setting('app.settings.jwt_secret', true)
  );
END;
$$;
