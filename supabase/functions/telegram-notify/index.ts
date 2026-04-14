// supabase/functions/telegram-notify/index.ts — Telegram notification relay
// Called by nightly-batch (Sunday digest) or CoachDashboard (RSVP alerts).
// Requires TELEGRAM_BOT_TOKEN set in Supabase edge-function secrets.
//
// POST body: { chat_id: string, message: string, type: string }
// Returns:   { ok: true } | { ok: false, error: string }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const TELEGRAM_API = "https://api.telegram.org/bot"
const VALID_TYPES = ["check_in_reminder", "coach_alert", "weekly_digest"]

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")
  if (!botToken) {
    return new Response(JSON.stringify({ ok: false, error: "TELEGRAM_BOT_TOKEN not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  let body: { chat_id?: string; message?: string; type?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { chat_id, message, type } = body

  if (!chat_id || !message) {
    return new Response(JSON.stringify({ ok: false, error: "chat_id and message required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (type && !VALID_TYPES.includes(type)) {
    return new Response(JSON.stringify({ ok: false, error: `Invalid type. Use: ${VALID_TYPES.join(", ")}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Enforce max message length (Telegram limit: 4096 chars)
  const safeMessage = message.slice(0, 4000)

  try {
    const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id,
        text:       safeMessage,
        parse_mode: "HTML",
      }),
    })

    const data = await res.json()
    if (!res.ok || !data.ok) {
      const errDesc = data?.description ?? `HTTP ${res.status}`
      console.error(`telegram-notify: Telegram API error for chat_id=${chat_id}: ${errDesc}`)
      return new Response(JSON.stringify({ ok: false, error: errDesc }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      })
    }

    console.log(`telegram-notify: sent type=${type ?? "unset"} to chat_id=${chat_id}`)
    return new Response(JSON.stringify({ ok: true, message_id: data.result?.message_id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("telegram-notify: fetch error:", msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
