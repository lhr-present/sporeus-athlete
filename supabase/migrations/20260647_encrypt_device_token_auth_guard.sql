-- Close the encrypt_device_token unauthenticated-oracle gap.
--
-- 20260617_security_definer_rpc_lockdown.sql explicitly deferred this one: "Kept as-is
-- (self-guarded / client-needed): get_my_tier, encrypt_device_token, ... (held, uncertain)".
-- It was never actually self-guarded — unlike get_my_tier (which only ever operates on
-- auth.uid() internally, so it can't leak anyone else's data), encrypt_device_token takes
-- an arbitrary `plain text` argument with zero tie to the caller's identity, and is
-- EXECUTE-granted to PUBLIC + anon + authenticated. Confirmed live: any unauthenticated
-- caller with the public anon key can call it and get pgp_sym_encrypt(plain,
-- app.settings.jwt_secret) back — a chosen-plaintext oracle against the app's JWT secret.
-- The GUC is currently unset (function likely errors today), so this has not been
-- exploited, but the code-level hole is real and activates the moment that config value
-- is ever set. decrypt_device_token was correctly locked to service_role-only already;
-- encrypt_device_token is the one genuine client-callable (deviceSync.js:59, signed-in
-- user only) path that was missed.
--
-- Fix: revoke PUBLIC + anon (authenticated keeps EXECUTE — deviceSync.js calls this from
-- a signed-in client), and add an explicit auth.uid() guard inside the function body for
-- defense-in-depth against any future grant drift.

revoke execute on function public.encrypt_device_token(text) from public, anon;

create or replace function public.encrypt_device_token(plain text)
returns bytea
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  return pgp_sym_encrypt(
    plain,
    current_setting('app.settings.jwt_secret', true)
  );
end;
$function$;

grant execute on function public.encrypt_device_token(text) to authenticated, service_role;
