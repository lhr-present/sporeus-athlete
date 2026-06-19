// ─── dashboard/MissionHeadline.jsx — v8.102.0 ────────────────────────────────
// Mission #1: BUILD YOUR YEARLY PROGRAM. Renders ABOVE all other dashboard
// cards as the app's number-1 rule. When `sporeus-eliteProgram` localStorage
// has a populated `input` field (i.e. a plan exists), this component renders
// null and yields the daily anchor to TodayProgrammedSessionCard.
//
// Citations: Daniels 2014 · Bompa 2009 · Mujika 2003.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'

const STORAGE_KEY = 'sporeus-eliteProgram'

function MissionHeadline() {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'
  const [persisted] = useLocalStorage(STORAGE_KEY, null)

  // Has-plan state: the plan owns the daily anchor — TodayProgrammedSessionCard
  // already covers that surface at animationDelay 80ms. Don't double up.
  if (persisted && persisted.input) return null

  const onGetStarted = () => {
    const card = typeof document !== 'undefined'
      ? document.querySelector('[data-elite-program-card]')
      : null
    if (card && typeof card.scrollIntoView === 'function') {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setTimeout(() => {
      const input = typeof document !== 'undefined'
        ? document.querySelector('[data-elite-program-card] input[aria-label*="Current PR time"]')
        : null
      if (input && typeof input.focus === 'function') input.focus()
    }, 400)
  }

  const cardBase = {
    ...S.card,
    animationDelay: '0ms',
    padding: '20px',
    borderLeft: '4px solid #ff6600',
  }

  const headlineEN = 'BUILD YOUR YEARLY PROGRAM'
  const headlineTR = 'YILLIK PROGRAMINI OLUŞTUR'

  const lines = [
    {
      en: '4 inputs → full scientific yearly program',
      tr: '4 girdi → tam bilimsel yıllık program',
    },
    {
      en: 'VDOT/FTP/CSS-level paces and zones',
      tr: 'VDOT/FTP/CSS seviyesinde tempo ve bölgeler',
    },
    {
      en: 'Daily prescription · adherence · race autopsy',
      tr: 'Günlük reçete · uygulama · yarış otopsisi',
    },
  ]

  return (
    <div
      className="sp-card"
      role="region"
      aria-label="Mission · Görev"
      style={cardBase}
    >
      <div
        style={{
          ...S.mono,
          fontSize: '18px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: '#ff6600',
          marginBottom: '14px',
          lineHeight: 1.3,
        }}
      >
        {headlineEN}
        <span aria-hidden="true" style={{ margin: '0 8px', color: 'var(--muted)' }}>·</span>
        {headlineTR}
      </div>

      <div
        style={{
          ...S.mono,
          fontSize: '12px',
          color: 'var(--text)',
          lineHeight: 1.7,
          marginBottom: '16px',
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ marginBottom: '4px' }}>
            <span>{line.en}</span>
            <span aria-hidden="true" style={{ margin: '0 6px', color: 'var(--muted)' }}>·</span>
            <span>{line.tr}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onGetStarted}
        aria-label={isTR ? 'BAŞLA · GET STARTED' : 'GET STARTED · BAŞLA'}
        style={{
          ...S.btn,
          fontSize: '14px',
          padding: '12px 24px',
          width: '100%',
          letterSpacing: '0.05em',
        }}
      >
        GET STARTED
        <span aria-hidden="true" style={{ margin: '0 8px' }}>·</span>
        BAŞLA
      </button>

      <div
        style={{
          ...S.mono,
          fontSize: '10px',
          color: 'var(--muted)',
          marginTop: '14px',
          letterSpacing: '0.04em',
          opacity: 0.7,
        }}
      >
        Daniels 2014 · Bompa 2009 · Mujika 2003
      </div>
    </div>
  )
}

export default memo(MissionHeadline)
