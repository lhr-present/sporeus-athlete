// ─── dashboard/NewSessionTypeIntroCard.jsx — Novel session-type intro flag ──
// Surfaces analyzeNewSessionTypeIntro() output: session types introduced in
// the last 14 days that weren't part of the athlete's repertoire in the prior
// 90 days. Gabbett 2016 / Hulin 2014 novel-stimulus injury risk window.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeNewSessionTypeIntro } from '../../lib/athlete/newSessionTypeIntro.js'

const BAND_COLOR = {
  NO_NOVEL:       '#5bc25b',
  SINGLE_NOVEL:   '#f5c542',
  MULTIPLE_NOVEL: '#ff6600',
}

const BAND_LABEL = {
  NO_NOVEL:       { en: 'NO NEW TYPES',   tr: 'YENİ TÜR YOK' },
  SINGLE_NOVEL:   { en: '1 NEW TYPE',     tr: '1 YENİ TÜR' },
  MULTIPLE_NOVEL: { en: 'MULTIPLE NEW',   tr: 'BİRDEN ÇOK' },
}

const BAND_HINT = {
  NO_NOVEL: {
    en: 'No novel session types introduced this fortnight — current stimuli are familiar.',
    tr: 'Bu iki haftada yeni seans türü tanıtılmadı — mevcut uyaranlar tanıdık.',
  },
  SINGLE_NOVEL: {
    en: 'A new session type has entered your training. Expect a short adaptation window.',
    tr: 'Antrenmana yeni bir seans türü girdi. Kısa bir adaptasyon penceresi bekleyin.',
  },
  MULTIPLE_NOVEL: {
    en: 'Several new session types at once — elevated novel-stimulus injury risk.',
    tr: 'Aynı anda birden çok yeni seans türü — yüksek yeni-uyaran yaralanma riski.',
  },
}

const EXPLAIN_HINT = {
  en: 'Gabbett novel-stimulus risk: unfamiliar movement patterns load tissues the body hasn’t adapted to. Manage volume + recovery during the first 2–3 weeks.',
  tr: 'Gabbett yeni-uyaran riski: tanıdık olmayan hareket kalıpları, vücudun henüz uyum sağlamadığı dokulara yük bindirir. İlk 2–3 hafta hacim ve toparlanmayı yönetin.',
}

function fmtDays(n, isTR) {
  if (isTR) return `${n} gün`
  return `${n} day${n === 1 ? '' : 's'}`
}

function fmtCount(n, isTR) {
  if (isTR) return `${n} seans`
  return `${n} session${n === 1 ? '' : 's'}`
}

function NewSessionTypeIntroCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => analyzeNewSessionTypeIntro({ log }), [log])

  if (!result) return null

  const title = isTR ? 'YENİ ANTRENMAN TÜRLERİ' : 'NEW SESSION TYPES'
  const ariaLabel = isTR ? 'Yeni antrenman türleri' : 'New session types'
  const accent = BAND_COLOR[result.band] || '#888'
  const bandLabel = BAND_LABEL[result.band][isTR ? 'tr' : 'en']
  const bandHint = BAND_HINT[result.band][isTR ? 'tr' : 'en']
  const explain = EXPLAIN_HINT[isTR ? 'tr' : 'en']

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="new-session-type-intro"
      style={{ ...S.card, animationDelay: '460ms', borderLeft: `3px solid ${accent}` }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* Band-coloured status strip */}
      <div
        data-band={result.band}
        style={{
          display: 'inline-block',
          ...S.mono,
          fontSize: '10px',
          fontWeight: 700,
          color: '#fff',
          background: accent,
          padding: '3px 8px',
          borderRadius: '3px',
          letterSpacing: '0.08em',
          marginBottom: '10px',
        }}
      >
        {bandLabel}
      </div>

      {/* Band hint */}
      <div
        aria-live="polite"
        style={{
          ...S.mono,
          fontSize: '12px',
          color: 'var(--text)',
          lineHeight: 1.6,
          marginBottom: '10px',
        }}
      >
        {bandHint}
      </div>

      {/* Novel-type list */}
      {result.novelTypes.length > 0 && (
        <div
          role="list"
          aria-label={isTR ? 'Yeni türler listesi' : 'List of new types'}
          style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}
        >
          {result.novelTypes.map((n) => (
            <div
              key={n.type}
              role="listitem"
              data-novel-type={n.type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderLeft: `2px solid ${accent}`,
                background: 'var(--surface, transparent)',
                borderRadius: '3px',
              }}
            >
              <span
                style={{
                  ...S.mono,
                  fontSize: '11px',
                  fontWeight: 700,
                  color: accent,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  flex: '1 1 auto',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {n.type}
              </span>
              <span
                style={{
                  ...S.mono,
                  fontSize: '10px',
                  color: 'var(--muted)',
                  letterSpacing: '0.04em',
                }}
              >
                {n.firstSeen}
              </span>
              <span
                style={{
                  display: 'inline-block',
                  ...S.mono,
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#fff',
                  background: accent,
                  padding: '2px 6px',
                  borderRadius: '3px',
                  letterSpacing: '0.04em',
                }}
              >
                {fmtCount(n.countInRecent, isTR)}
              </span>
              <span
                style={{
                  ...S.mono,
                  fontSize: '10px',
                  color: 'var(--muted)',
                  letterSpacing: '0.04em',
                }}
              >
                {isTR ? `${fmtDays(n.daysSinceFirst, true)} önce` : `${fmtDays(n.daysSinceFirst, false)} ago`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Explainer */}
      <div
        style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--sub, var(--muted))',
          lineHeight: 1.6,
          marginBottom: '8px',
        }}
      >
        {explain}
      </div>

      {/* Citation footer */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(NewSessionTypeIntroCard)
