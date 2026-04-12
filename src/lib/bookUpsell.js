// ─── bookUpsell.js — Contextual upsell triggers ──────────────────────────────
// Pure JS. No external deps. Deterministic — same input always returns same output.

const EN_URL = 'https://sporeus.com/threshold'
const TR_URL = 'https://sporeus.com/esik'

/**
 * getUpsellTrigger — returns the highest-priority trigger card payload or null.
 * @param {{ acwr: number|null, tsb: number|null, consistency: number, isFirstCheckin: boolean }} athleteData
 * @param {'en'|'tr'} lang
 * @returns {{ title: string, body: string, cta: string, url: string, trigger_reason: string } | null}
 */
export function getUpsellTrigger(athleteData, lang = 'en') {
  if (!athleteData || typeof athleteData !== 'object') return null
  const { acwr, tsb, consistency, isFirstCheckin } = athleteData
  const isTR = lang === 'tr'
  const url  = isTR ? TR_URL : EN_URL

  // Priority 1 — ACWR danger zone (injury risk)
  if (typeof acwr === 'number' && acwr > 1.3) {
    return {
      title:          isTR ? 'Tehlike bölgesindesiniz' : "You're in the danger zone",
      body:           isTR
        ? "ACWR değeriniz kritik eşiğin üzerinde. EŞİK'in 8. bölümü bunun tam olarak neden olduğunu açıklıyor."
        : 'Your ACWR is above the critical threshold. Chapter 8 of THRESHOLD explains exactly why.',
      cta:            isTR ? "EŞİK'i İncele →" : 'Read THRESHOLD →',
      url,
      trigger_reason: 'acwr_danger',
    }
  }

  // Priority 2 — deep negative TSB (accumulated fatigue)
  if (typeof tsb === 'number' && tsb < -20) {
    return {
      title:          isTR ? 'Birikmiş yorgunluk tespit edildi' : 'Accumulated fatigue detected',
      body:           isTR
        ? 'Yorgunluk bir bilimdir. EŞİK kitabı Banister modelini eksiksiz kapsamaktadır.'
        : 'Accumulated fatigue is a science. THRESHOLD covers the full Banister model.',
      cta:            isTR ? "EŞİK'i İncele →" : 'Read THRESHOLD →',
      url,
      trigger_reason: 'tsb_fatigue',
    }
  }

  // Priority 3 — low training consistency
  if (typeof consistency === 'number' && consistency < 40) {
    return {
      title:          isTR ? 'Tutarlılıkla mı zorlanıyorsunuz?' : 'Struggling with consistency?',
      body:           isTR
        ? "Düzenli antrenman yapmak zor mu? EŞİK'in 3. bölümü tam bunun için."
        : 'Struggling with training consistency? Chapter 3 of THRESHOLD is for you.',
      cta:            isTR ? "EŞİK'i İncele →" : 'Read THRESHOLD →',
      url,
      trigger_reason: 'consistency_low',
    }
  }

  // Priority 4 — first check-in ever (welcome)
  if (isFirstCheckin) {
    return {
      title:          isTR ? 'Hoş geldiniz' : 'Welcome',
      body:           isTR
        ? "Bu uygulamanın arkasındaki bilim EŞİK'te — 15 Nisan'da yayında."
        : 'The science behind this app is in THRESHOLD — launching April 15.',
      cta:            isTR ? 'Ön Kayıt →' : 'Pre-Register →',
      url,
      trigger_reason: 'first_checkin',
    }
  }

  return null
}

/** Returns true if this trigger was previously dismissed by the user. */
export function isUpsellDismissed(trigger_reason) {
  try { return localStorage.getItem(`sporeus-upsell-dismissed-${trigger_reason}`) === '1' } catch { return false }
}

/** Persist dismissal so this trigger never shows again on this device. */
export function dismissUpsell(trigger_reason) {
  try { localStorage.setItem(`sporeus-upsell-dismissed-${trigger_reason}`, '1') } catch {}
}

/** Append a timestamped impression entry (capped at 50) to sporeus-upsell-log. */
export function trackUpsellImpression(trigger_reason) {
  try {
    const existing = JSON.parse(localStorage.getItem('sporeus-upsell-log') || '[]')
    existing.push({ trigger_reason, ts: Date.now() })
    localStorage.setItem('sporeus-upsell-log', JSON.stringify(existing.slice(-50)))
  } catch {}
}
