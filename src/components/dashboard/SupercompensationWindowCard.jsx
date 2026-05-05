// ─── dashboard/SupercompensationWindowCard.jsx — Peak Readiness Window ──────
// Surfaces detectSupercompensation(): the constructive opposite of recovery
// debt — quantifies the post-deload window when CTL holds while ATL drops
// and TSB rises sharply. Bands: peak, opportunity, available, closed,
// building. Cite: Foster 1996; Costill 1991; Mujika 2010.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectSupercompensation } from '../../lib/athlete/supercompensationWindow.js'

const BAND_COLOR = {
  peak:        '#28a745',
  opportunity: '#0064ff',
  available:   '#9acd32',
  closed:      '#6c757d',
  building:    '#ffd700',
}

const BAND_LABEL = {
  peak:        { en: 'PEAK',        tr: 'ZİRVE' },
  opportunity: { en: 'OPPORTUNITY', tr: 'FIRSAT' },
  available:   { en: 'AVAILABLE',   tr: 'UYGUN' },
  closed:      { en: 'CLOSED',      tr: 'KAPALI' },
  building:    { en: 'BUILDING',    tr: 'YAKLAŞIYOR' },
}

function fmtSigned1(v) {
  const n = Number(v) || 0
  const s = n.toFixed(1)
  return n > 0 ? `+${s}` : s
}

export default function SupercompensationWindowCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectSupercompensation(log), [log])

  const title = isTR ? 'SÜPERKOMPANSASYON PENCERESİ' : 'SUPERCOMPENSATION WINDOW'

  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR
          ? 'Süperkompansasyon penceresi — yetersiz veri'
          : 'Supercompensation window — insufficient data'}
        style={{ ...S.card, animationDelay: '320ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Pencere tespiti için 28+ günlük log gerekli'
            : 'Log 28+ days to detect supercompensation windows'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const accent = BAND_COLOR[result.band] || BAND_COLOR.closed
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en'] || result.band.toUpperCase()
  const tsbStr = fmtSigned1(result.currentTSB)
  const ctlStr = result.ctlToday.toFixed(1)
  const atlStr = result.atlToday.toFixed(1)
  const message = result.message?.[isTR ? 'tr' : 'en'] || ''
  const recommendation = result.recommendation?.[isTR ? 'tr' : 'en'] || ''

  if (result.band === 'closed') {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Süperkompansasyon penceresi' : 'Supercompensation window'}
        style={{ ...S.card, animationDelay: '320ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          padding: '8px 0', lineHeight: 1.7,
        }}>
          {isTR ? 'Pencere yok' : 'No window'}
          <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
          {isTR ? 'Pencere yok' : 'No window'}
        </div>
        <div style={{
          ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))',
          marginBottom: '6px', letterSpacing: '0.04em',
        }}>
          {`TSB: ${tsbStr}`}
          <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
          {`CTL: ${ctlStr}`}
          <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
          {`ATL: ${atlStr}`}
        </div>
        {message ? (
          <div style={{
            ...S.mono, fontSize: '11px', color: 'var(--text)',
            lineHeight: 1.6, paddingLeft: '8px',
            borderLeft: `2px solid ${accent}`, marginBottom: '8px',
          }}>
            {message}
          </div>
        ) : null}
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const showPeakDays = ['peak', 'opportunity', 'available'].includes(result.band)
  const bigLeft = showPeakDays
    ? String(result.peakDaysRemaining)
    : (result.daysSinceLastDeload != null ? String(result.daysSinceLastDeload) : '—')
  const bigLeftLblEn = showPeakDays ? 'DAYS LEFT' : 'DAYS SINCE'
  const bigLeftLblTr = showPeakDays ? 'GÜN KALDI' : 'GÜN GEÇTİ'

  const ariaRow = isTR
    ? `${bandLbl} — ${bigLeft} ${bigLeftLblTr}, TSB ${tsbStr}`
    : `${bandLbl} — ${bigLeft} ${bigLeftLblEn}, TSB ${tsbStr}`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Süperkompansasyon penceresi' : 'Supercompensation window'}
      style={{ ...S.card, animationDelay: '320ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      <div style={{
        display: 'inline-block',
        ...S.mono,
        fontSize: '11px',
        fontWeight: 700,
        color: '#fff',
        background: accent,
        padding: '4px 10px',
        borderRadius: '3px',
        letterSpacing: '0.08em',
        marginBottom: '10px',
      }}>
        {bandLbl}
      </div>

      <div
        aria-live="polite"
        aria-label={ariaRow}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '24px',
          padding: '4px 0 8px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{
            ...S.mono,
            fontSize: '32px',
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {bigLeft}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}>
            {bigLeftLblEn}
            <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
            {bigLeftLblTr}
          </div>
        </div>

        <div>
          <div style={{
            ...S.mono,
            fontSize: '32px',
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {tsbStr}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}>
            TSB
            <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
            TSB
          </div>
        </div>
      </div>

      {result.tsbRise7d > 0 ? (
        <div style={{
          ...S.mono,
          fontSize: '10px',
          color: 'var(--sub, var(--muted))',
          marginBottom: '6px',
          letterSpacing: '0.04em',
        }}>
          {isTR
            ? `Son 7G'de TSB +${result.tsbRise7d.toFixed(1)} yükseldi`
            : `TSB rose +${result.tsbRise7d.toFixed(1)} over last 7d`}
        </div>
      ) : null}

      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '6px',
        letterSpacing: '0.04em',
      }}>
        {`CTL: ${ctlStr}`}
        <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
        {`ATL: ${atlStr}`}
      </div>

      {result.daysSinceLastDeload != null && showPeakDays ? (
        <div style={{
          ...S.mono,
          fontSize: '10px',
          color: 'var(--sub, var(--muted))',
          marginBottom: '10px',
          letterSpacing: '0.04em',
        }}>
          {isTR
            ? `Deloadtan beri: ${result.daysSinceLastDeload} gün`
            : `Days since deload: ${result.daysSinceLastDeload}`}
        </div>
      ) : null}

      {message ? (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          paddingLeft: '8px',
          borderLeft: `2px solid ${accent}`,
          marginBottom: '8px',
        }}>
          {message}
        </div>
      ) : null}

      {recommendation ? (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--sub, var(--muted))',
          lineHeight: 1.6,
          marginBottom: '8px',
        }}>
          {recommendation}
        </div>
      ) : null}

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}
