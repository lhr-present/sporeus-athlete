// ─── upsell.js — Daily upsell gating and messaging ───────────────────────────

// shouldShowUpsell(feature)
// Returns false if 'sporeus-upsell-shown-{feature}' localStorage key has today's date
// Returns true otherwise
export function shouldShowUpsell(feature) {
  try {
    const key = `sporeus-upsell-shown-${feature}`
    const stored = localStorage.getItem(key)
    const today = new Date().toISOString().slice(0, 10)
    return stored !== today
  } catch { return true }
}

// markUpsellShown(feature)
// Sets 'sporeus-upsell-shown-{feature}' to today's date
export function markUpsellShown(feature) {
  try {
    const key = `sporeus-upsell-shown-${feature}`
    localStorage.setItem(key, new Date().toISOString().slice(0, 10))
  } catch {}
}

// getUpsellMessage(feature, lang = 'en')
// Returns { title: string, description: string, plan: 'coach'|'club' }
export function getUpsellMessage(feature, lang = 'en') {
  const messages = {
    ai_insights: {
      en: { title: 'AI Insights — Coach Plan', description: 'Unlimited AI summaries require the Coach plan — ₺500/month', plan: 'coach' },
      tr: { title: 'AI Özetleri — Koç Planı', description: 'Sınırsız AI özeti için Koç Planı gereklidir — ₺500/ay', plan: 'coach' },
    },
    squad_dashboard: {
      en: { title: 'Squad Dashboard — Coach Plan', description: 'Manage multiple athletes with the Coach plan — ₺500/month', plan: 'coach' },
      tr: { title: 'Takım Paneli — Koç Planı', description: 'Birden fazla sporcu yönetimi için Koç Planı gereklidir — ₺500/ay', plan: 'coach' },
    },
    unlimited_athletes: {
      en: { title: 'Unlimited Athletes — Club Plan', description: 'More than 20 athletes requires the Club plan — ₺1,000/month', plan: 'club' },
      tr: { title: 'Sınırsız Sporcu — Kulüp Planı', description: '20\'den fazla sporcu için Kulüp Planı gereklidir — ₺1.000/ay', plan: 'club' },
    },
    weekly_digest: {
      en: { title: 'Weekly Digest — Coach Plan', description: 'Sunday AI squad digest requires the Coach plan — ₺500/month', plan: 'coach' },
      tr: { title: 'Haftalık Özet — Koç Planı', description: 'Pazar AI özeti için Koç Planı gereklidir — ₺500/ay', plan: 'coach' },
    },
  }
  const entry = messages[feature] ?? messages['ai_insights']
  return entry[lang] ?? entry['en']
}
