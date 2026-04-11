// supabase/functions/squad-sync/index.ts
// Returns squad overview metrics for the authenticated coach.
// Calls get_squad_overview(coach_id) postgres function.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  })
}

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return fail(401, "Missing authorization header")

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  )

  // Verify JWT — coach_id = sub claim (user UUID)
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) return fail(401, "Invalid or expired JWT")

  const { data, error } = await supabaseClient.rpc("get_squad_overview", {
    p_coach_id: user.id,
  })

  if (error) return fail(500, error.message)

  return ok(data ?? [])
})
