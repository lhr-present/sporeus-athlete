// ─── dashboard/TrainAfterRestCard.jsx — Post-rest rebound load tracker ─────
// Surfaces analyzeTrainAfterRest(): the mean session TSS the day AFTER a rest
// day, compared with the overall mean training-day TSS over the last 60d.
// Catches the classic amateur rebound pattern — feeling guilty after rest and
// crushing a hard workout the next day (Bompa 2018; Skorski 2019).
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeTrainAfterRest } from '../../lib/athlete/trainAfterRest.js'

// ─── Palette ────────────────────────────────────────────────────────────────
const BAND_COLOR = {
  CONSERVATIVE_REBOUND:      '#5bc25b',
  BALANCED:                  '#0064ff',
  AGGRESSIVE_REBOUND:        '#e03030',
  INSUFFICIENT_REBOUND_DAYS: '#888888',
}

const BAND_LABEL = {
  CONSERVATIVE_REBOUND:      { en: 'CONSERVATIVE',  tr: 'TEMKİNLİ' },
  BALANCED:                  { en: 'BALANCED',      tr: 'DENGELİ' },
  AGGRESSIVE_REBOUND:        { en: 'AGGRESSIVE',    tr: 'AGRESİF' },
  INSUFFICIENT_REBOUND_DAYS: { en: 'INSUFFICIENT',  tr: 'YETERSİZ VERİ' },
}

const BAND_HINT = {
  CONSERVATIVE_REBOUND: {
    en: 'Post-rest days are markedly easier than typical training days. Good restraint — supercompensation lands.',
    tr: 'Dinlenme sonrası günler tipik antrenman günlerinden belirgin biçimde daha hafif. İyi bir disiplin — süperkompansasyon karşılığını verir.',
  },
  BALANCED: {
    en: 'Post-rest sessions sit near your typical training load. No rebound overcommit pattern.',
    tr: 'Dinlenme sonrası seanslar tipik antrenman yüküne yakın. Geri dönüşte aşırılık deseni yok.',
  },
  AGGRESSIVE_REBOUND: {
    en: 'Post-rest days are markedly harder than typical — classic guilt-rebound overcommit. Try a moderate session instead.',
    tr: 'Dinlenme sonrası günler tipik antrenmandan belirgin biçimde daha sert — klasik suçluluk-geri dönüş aşırılığı. Bunun yerine orta yoğunlukta bir seans dene.',
  },
  INSUFFICIENT_REBOUND_DAYS: {
    en: 'Not enough post-rest training days yet — keep logging for a clearer rebound pattern.',
    tr: 'Henüz yeterli sayıda dinlenme-sonrası antrenman günü yok — geri dönüş deseninin netleşmesi için kaydetmeye devam et.',
  },
}

// "May 12" / "12 May" (no year — short label)
const MONTH_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function formatChipDate(iso, isTR) {
  if (typeof iso !== 'string' || iso.length < 10) return iso
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  if (!Number.isFinite(m) || !Number.isFinite(d)) return iso
  const mon = (isTR ? MONTH_TR : MONTH_EN)[m - 1] || ''
  return isTR ? `${d} ${mon}` : `${mon} ${d}`
}

export default function TrainAfterRestCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(() => analyzeTrainAfterRest({ log, today: new Date() }), [log])

  if (!result) return null

  const {
    band,
    postRestSessions,
    meanPostRestTss,
    meanTrainingDayTss,
    reboundRatio,
    postRestCount,
    citation,
  } = result

  const accent = BAND_COLOR[band] || BAND_COLOR.BALANCED
  const bandLbl = BAND_LABEL[band]?.[isTR ? 'tr' : 'en'] || band
  const hint = BAND_HINT[band]?.[isTR ? 'tr' : 'en'] || ''

  const title = isTR
    ? 'DİNLENME SONRASI GERİ DÖNÜŞ · 60G'
    : 'POST-REST REBOUND · 60D'

  const ariaLabel = isTR
    ? 'Dinlenme sonrası geri dönüş'
    : 'Post-rest rebound'

  // Big-stat — "1.4×" or "0.8×". For INSUFFICIENT show "—".
  const ratioLabel = band === 'INSUFFICIENT_REBOUND_DAYS'
    ? '—'
    : `${reboundRatio.toFixed(2).replace(/\.?0+$/, '') || '0'}×`

  const postRestTssLine = isTR
    ? `Dinlenme sonrası TSS: ${meanPostRestTss.toFixed(0)}`
    : `Post-rest TSS: ${meanPostRestTss.toFixed(0)}`
  const trainingTssLine = isTR
    ? `Antrenman günü TSS: ${meanTrainingDayTss.toFixed(0)}`
    : `Training-day TSS: ${meanTrainingDayTss.toFixed(0)}`

  const countLine = isTR
    ? `${postRestCount} dinlenme sonrası gün`
    : `${postRestCount} post-rest day${postRestCount === 1 ? '' : 's'}`

  // Most-recent 3 post-rest sessions for chips.
  const recentChips = postRestSessions.slice(-3).reverse()

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="train-after-rest"
      data-tar-band={band}
      data-tar-rebound-ratio={reboundRatio}
      data-tar-mean-post-rest-tss={meanPostRestTss}
      data-tar-mean-training-day-tss={meanTrainingDayTss}
      data-tar-post-rest-count={postRestCount}
      style={{ ...S.card, borderLeft: `4px solid ${accent}`, padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* Big ratio + band badge ------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '34px',
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {ratioLabel}
        </div>
        <div
          data-tar-band-badge={band}
          style={{
            ...S.mono,
            fontSize: '10px',
            fontWeight: 700,
            color: '#fff',
            background: accent,
            padding: '4px 10px',
            borderRadius: '3px',
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}
        >
          {bandLbl}
        </div>
      </div>

      {/* Side-by-side TSS rows -------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '10px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 120px' }}>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            marginBottom: '2px',
          }}>
            {isTR ? 'DİNLENME SONRASI' : 'POST-REST'}
          </div>
          <div
            data-tar-mean-post-rest-tss-display
            style={{
              ...S.mono,
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text)',
              lineHeight: 1.1,
            }}
          >
            {meanPostRestTss.toFixed(0)}
            <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--muted)', marginLeft: '4px' }}>
              TSS
            </span>
          </div>
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            marginBottom: '2px',
          }}>
            {isTR ? 'ANTRENMAN ORT.' : 'TRAINING AVG.'}
          </div>
          <div
            data-tar-mean-training-day-tss-display
            style={{
              ...S.mono,
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text)',
              lineHeight: 1.1,
            }}
          >
            {meanTrainingDayTss.toFixed(0)}
            <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--muted)', marginLeft: '4px' }}>
              TSS
            </span>
          </div>
        </div>
      </div>

      {/* Count line (hidden under postRestTssLine + trainingTssLine in mono) */}
      <div
        style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginBottom: '10px', letterSpacing: '0.04em' }}
      >
        {countLine}
        <span aria-hidden="true" style={{ position: 'absolute', left: -9999, top: -9999 }}>
          {postRestTssLine} · {trainingTssLine}
        </span>
      </div>

      {/* Recent post-rest session chips ----------------------------------- */}
      {recentChips.length > 0 ? (
        <div
          role="list"
          aria-label={isTR ? 'Son dinlenme sonrası seanslar' : 'Recent post-rest sessions'}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}
        >
          {recentChips.map(s => {
            const restWord = isTR ? 'g dinl' : 'd rest'
            const tssLbl = `${s.dayTss.toFixed(0)} TSS`
            const dateLbl = formatChipDate(s.date, isTR)
            return (
              <div
                key={s.date}
                role="listitem"
                data-tar-chip-date={s.date}
                data-tar-chip-tss={s.dayTss}
                data-tar-chip-rest-days={s.restDaysBefore}
                style={{
                  ...S.mono,
                  fontSize: '10px',
                  color: accent,
                  background: `${accent}14`,
                  border: `1px solid ${accent}44`,
                  borderRadius: '3px',
                  padding: '2px 6px',
                }}
              >
                {`${dateLbl} (${s.restDaysBefore}${restWord}, ${tssLbl})`}
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Band-coloured interpretation strip ------------------------------- */}
      {hint ? (
        <div
          style={{
            ...S.mono,
            fontSize: '11px',
            color: 'var(--text)',
            lineHeight: 1.55,
            paddingLeft: '8px',
            borderLeft: `2px solid ${accent}`,
            marginBottom: '8px',
          }}
        >
          {hint}
        </div>
      ) : null}

      {/* Citation footer -------------------------------------------------- */}
      <div
        style={{
          ...S.mono,
          fontSize: '9px',
          color: '#555',
          marginTop: '4px',
          letterSpacing: '0.04em',
        }}
      >
        {citation}
      </div>
    </div>
  )
}
