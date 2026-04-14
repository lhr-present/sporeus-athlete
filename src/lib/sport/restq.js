// ─── restq.js — RESTQ-Sport Short Form (19 items) ────────────────────────────
// Adapted from Kellmann & Kallus (2001) RESTQ-Sport.
// Scale: 0 (Never) to 6 (Always), 7-day recall period.
// Stress items: higher score = more stress (bad)
// Recovery items: higher score = more recovery (good)
// Reference: Kellmann M, Kallus KW (2001). Recovery-Stress Questionnaire for Athletes.
// ─────────────────────────────────────────────────────────────────────────────

export const RESTQ_ITEMS = [
  // ── General Stress ───────────────────────────────────────────────────────────
  { id:'gs1', subscale:'General Stress',     type:'stress',   text_en:'I experienced a great deal of stress',          text_tr:'Büyük bir stres yaşadım' },
  { id:'gs2', subscale:'General Stress',     type:'stress',   text_en:'I felt overloaded by tasks and demands',        text_tr:'Görevler ve talepler altında ezildim' },
  { id:'gs3', subscale:'General Stress',     type:'stress',   text_en:'I felt under time pressure',                   text_tr:'Zaman baskısı hissettim' },
  // ── Emotional Stress ─────────────────────────────────────────────────────────
  { id:'es1', subscale:'Emotional Stress',   type:'stress',   text_en:'I was irritable',                              text_tr:'Sinirliydim' },
  { id:'es2', subscale:'Emotional Stress',   type:'stress',   text_en:'I had periods of anxiety or worry',            text_tr:'Kaygı ya da endişe dönemleri yaşadım' },
  // ── Physical Complaints ───────────────────────────────────────────────────────
  { id:'pc1', subscale:'Physical Complaints',type:'stress',   text_en:'My muscles felt sore or heavy',                text_tr:'Kaslarım ağrılı veya ağır hissettirdi' },
  { id:'pc2', subscale:'Physical Complaints',type:'stress',   text_en:'I felt physically fatigued',                   text_tr:'Fiziksel olarak yorgun hissettim' },
  // ── Lack of Energy ────────────────────────────────────────────────────────────
  { id:'le1', subscale:'Lack of Energy',     type:'stress',   text_en:'I felt lethargic or listless',                 text_tr:'Uyuşuk veya isteksiz hissettim' },
  { id:'le2', subscale:'Lack of Energy',     type:'stress',   text_en:'I had difficulty concentrating during training',text_tr:'Antrenmanda konsantre olmakta güçlük çektim' },
  // ── Overall Recovery ──────────────────────────────────────────────────────────
  { id:'or1', subscale:'Overall Recovery',   type:'recovery', text_en:'I felt physically recovered',                  text_tr:'Fiziksel olarak iyileşmiş hissettim' },
  { id:'or2', subscale:'Overall Recovery',   type:'recovery', text_en:'I enjoyed my training sessions',               text_tr:'Antrenman seanslarımın tadını çıkardım' },
  { id:'or3', subscale:'Overall Recovery',   type:'recovery', text_en:'I felt well-rested',                           text_tr:'İyi dinlenmiş hissettim' },
  // ── Sleep Quality ─────────────────────────────────────────────────────────────
  { id:'sq1', subscale:'Sleep Quality',      type:'recovery', text_en:'I slept well',                                 text_tr:'İyi uyudum' },
  { id:'sq2', subscale:'Sleep Quality',      type:'recovery', text_en:'I woke up feeling refreshed',                  text_tr:'Dinlenerek uyandım' },
  // ── Social Recovery ───────────────────────────────────────────────────────────
  { id:'sr1', subscale:'Social Recovery',    type:'recovery', text_en:'I enjoyed spending time with others',          text_tr:'Başkalarıyla vakit geçirmekten zevk aldım' },
  { id:'sr2', subscale:'Social Recovery',    type:'recovery', text_en:'I felt supported by my social network',        text_tr:'Sosyal çevremden destek gördüm' },
  // ── Self-Efficacy ─────────────────────────────────────────────────────────────
  { id:'se1', subscale:'Self-Efficacy',      type:'recovery', text_en:'I felt confident in my training',              text_tr:'Antrenmanıma güveniyordum' },
  { id:'se2', subscale:'Self-Efficacy',      type:'recovery', text_en:'I felt ready to perform well',                 text_tr:'İyi bir performans sergilemeye hazır hissettim' },
  // ── Self-Regulation ───────────────────────────────────────────────────────────
  { id:'sg1', subscale:'Self-Regulation',    type:'recovery', text_en:'I was able to focus during my sessions',       text_tr:'Seanslarım sırasında odaklanabiliyordum' },
]

/**
 * Score a completed RESTQ-Sport Short Form.
 * @param {Object} responses — { itemId: value (0-6), … } for all 19 items
 * @returns {{ overall_stress, overall_recovery, balance, subscales, interpretation, completeness }}
 */
export function scoreRESTQ(responses) {
  if (!responses || typeof responses !== 'object') {
    return { overall_stress: null, overall_recovery: null, balance: null, subscales: {}, interpretation: 'incomplete', completeness: 0 }
  }

  const answered = RESTQ_ITEMS.filter(item => typeof responses[item.id] === 'number' && responses[item.id] >= 0 && responses[item.id] <= 6)
  const completeness = Math.round(answered.length / RESTQ_ITEMS.length * 100)

  if (answered.length < 10) {
    return { overall_stress: null, overall_recovery: null, balance: null, subscales: {}, interpretation: 'incomplete', completeness }
  }

  // Group by subscale
  const subscaleGroups = {}
  for (const item of RESTQ_ITEMS) {
    if (!subscaleGroups[item.subscale]) subscaleGroups[item.subscale] = { type: item.type, values: [] }
    const v = responses[item.id]
    if (typeof v === 'number' && v >= 0 && v <= 6) subscaleGroups[item.subscale].values.push(v)
  }

  const subscales = {}
  for (const [name, { type, values }] of Object.entries(subscaleGroups)) {
    if (values.length === 0) continue
    subscales[name] = {
      type,
      mean: Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10,
      n: values.length,
    }
  }

  const stressItems    = answered.filter(i => i.type === 'stress')
  const recoveryItems  = answered.filter(i => i.type === 'recovery')

  const mean = (arr) => arr.reduce((s, item) => s + responses[item.id], 0) / arr.length

  const overall_stress   = stressItems.length   ? Math.round(mean(stressItems)   * 10) / 10 : null
  const overall_recovery = recoveryItems.length ? Math.round(mean(recoveryItems) * 10) / 10 : null
  const balance = (overall_stress != null && overall_recovery != null)
    ? Math.round((overall_recovery - overall_stress) * 10) / 10
    : null

  const interpretation = balance == null ? 'incomplete'
    : balance >= 2   ? 'well_recovered'
    : balance >= 0   ? 'adequate'
    : balance >= -1  ? 'watch'
    : 'overreaching_risk'

  const INTERP_LABELS = {
    well_recovered:   { en: 'Well-Recovered — maintain current training load',         tr: 'İyi Toparlanmış — mevcut antrenman yükünü koru' },
    adequate:         { en: 'Adequate — monitor closely this week',                    tr: 'Yeterli — bu hafta dikkatli izle' },
    watch:            { en: 'Watch Closely — consider reducing intensity',             tr: 'Dikkat Et — yoğunluğu azaltmayı düşün' },
    overreaching_risk:{ en: 'Overreaching Risk — reduce load and prioritise recovery', tr: 'Aşırı Yüklenme Riski — yükü azalt, toparlanmaya odaklan' },
    incomplete:       { en: 'Incomplete', tr: 'Tamamlanmamış' },
  }

  return { overall_stress, overall_recovery, balance, subscales, interpretation, interpretationLabel: INTERP_LABELS[interpretation], completeness }
}

/**
 * Check whether a new RESTQ screening is due.
 * @param {Array} history — stored RESTQ results (each has { date, … })
 * @param {number} logLength — number of log entries (require ≥14 to prompt)
 * @param {number} intervalDays — days between screens (default 28)
 * @returns {boolean}
 */
export function isRESTQDue(history, logLength, intervalDays = 28) {
  if (!logLength || logLength < 14) return false
  if (!history || history.length === 0) return true
  const lastDate = history.reduce((latest, r) => r.date > latest ? r.date : latest, '')
  const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
  return daysSince >= intervalDays
}
