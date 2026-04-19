// src/components/science/MetricExplainer.jsx
// E3 — Reusable metric info sheet (bottom sheet / popover)
// Shows: metric name, current value, citation, plain-language explanation.
// Uses LangCtx for bilingual copy. Zero external deps (no portal, no modal lib).

import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../../contexts/LangCtx.jsx'

/**
 * @param {Object}  props
 * @param {string}  props.metricKey  - unique key for this metric (e.g. 'acwr', 'ctl', 'tsb')
 * @param {string|number} [props.value]   - formatted value to display (optional)
 * @param {string}  [props.citation] - publication citation string
 * @param {Object}  [props.explanation] - { en, tr } plain-language explanation
 * @param {React.ReactNode} [props.children] - trigger element (default: ⓘ button)
 */
export default function MetricExplainer({
  metricKey,
  value,
  citation,
  explanation,
  children,
}) {
  const [open, setOpen] = useState(false)
  const sheetRef = useRef(null)
  const { lang } = useLanguage()

  // Close on Escape or outside click
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onOutside = (e) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOutside)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutside)
    }
  }, [open])

  const explanationText = explanation
    ? (lang === 'tr' ? explanation.tr : explanation.en)
    : null

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={`Info: ${metricKey}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 4px',
          color: 'var(--muted)',
          fontSize: '0.75rem',
          lineHeight: 1,
          verticalAlign: 'middle',
          minWidth: 20,
          minHeight: 20,
        }}
      >
        {children ?? 'ⓘ'}
      </button>

      {/* Bottom sheet / popover */}
      {open && (
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${metricKey} explanation`}
          style={{
            position: 'absolute',
            bottom: '120%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: Math.min(320, window.innerWidth - 32),
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 14px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            zIndex: 9999,
            fontSize: '0.78rem',
            lineHeight: 1.5,
            color: 'var(--text)',
          }}
        >
          {/* Metric name + value */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
              {metricKey.toUpperCase()}
            </span>
            {value != null && (
              <span style={{ fontWeight: 700, color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace' }}>
                {value}
              </span>
            )}
          </div>

          {/* Explanation */}
          {explanationText && (
            <p style={{ margin: '0 0 8px', color: 'var(--text)' }}>
              {explanationText}
            </p>
          )}

          {/* Citation */}
          {citation && (
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.70rem', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
              {citation}
            </p>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 6,
              right: 8,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              fontSize: '1rem',
              lineHeight: 1,
              padding: '2px 4px',
            }}
          >
            ×
          </button>
        </div>
      )}
    </span>
  )
}

// ─── Pre-wired explainers for known metrics ───────────────────────────────────
// Usage: <ACWRExplainer value={acwr.ratio} />

const METRIC_DEFS = {
  acwr: {
    citation: 'Gabbett T.J. (2016) Br J Sports Med 50:273–280; Hulin et al. (2016) 50:231–236',
    explanation: {
      en: 'Acute:Chronic Workload Ratio — how much stress you took on this week vs your rolling 28-day baseline. Optimal 0.8–1.3; > 1.5 raises injury risk.',
      tr: 'Akut:Kronik İş Yükü Oranı — bu haftaki stresin 28 günlük baz değerine oranı. Optimal 0.8–1.3; 1.5 üzeri sakatlanma riskini artırır.',
    },
  },
  ctl: {
    citation: 'Banister E.W. & Calvert T.W. (1980). Planning for future performance.',
    explanation: {
      en: 'Chronic Training Load (CTL) — your 42-day exponentially weighted training average. Higher CTL = more aerobic capacity. Builds slowly, decays slowly.',
      tr: 'Kronik Antrenman Yükü (KTY) — 42 günlük üstel ağırlıklı antrenman ortalamanız. Yüksek KTY = daha fazla aerobik kapasite. Yavaş artar, yavaş azalır.',
    },
  },
  atl: {
    citation: 'Banister E.W. & Calvert T.W. (1980). Planning for future performance.',
    explanation: {
      en: 'Acute Training Load (ATL) — your 7-day exponentially weighted load. Reflects current fatigue. Builds fast, decays fast.',
      tr: 'Akut Antrenman Yükü (ATY) — 7 günlük üstel ağırlıklı yükünüz. Anlık yorgunluğu yansıtır. Hızlı artar, hızlı azalır.',
    },
  },
  tsb: {
    citation: 'Coggan A.R. Training & Racing with a Power Meter (2nd ed.)',
    explanation: {
      en: 'Training Stress Balance (TSB) = CTL − ATL. Positive = fresh/form; negative = fatigued/training. Race peak: aim for +5 to +25.',
      tr: 'Antrenman Stres Dengesi (ASD) = KTY − ATY. Pozitif = taze/form; negatif = yorgun/antrenman. Yarış zirvesi: +5 ile +25 arası hedefle.',
    },
  },
  decoupling: {
    citation: 'Friel J. The Cyclist\'s Training Bible, 4th ed. VeloPress, 2009.',
    explanation: {
      en: 'Aerobic decoupling (Pw:Hr) — how much your efficiency dropped between the first and second halves of a steady effort. < 5% = good aerobic base.',
      tr: 'Aerobik ayrışma (Güç:KAH) — kararlı bir çabanın birinci ve ikinci yarısı arasındaki verimlilik düşüşü. <%5 = iyi aerobik baz.',
    },
  },
  monotony: {
    citation: 'Foster C. (1998) Med Sci Sports Exerc 30(7):1164–1168.',
    explanation: {
      en: 'Training monotony = mean daily load ÷ standard deviation over 7 days. > 2.0 raises illness/overreach risk. Varies hard and easy days to keep monotony low.',
      tr: 'Antrenman monotonikliği = ortalama günlük yük ÷ 7 günlük standart sapma. 2.0 üzeri hastalık/aşırı yüklenme riskini artırır. Sert ve kolay günleri değiştirerek düşük tut.',
    },
  },
  np: {
    citation: 'Coggan A.R. (2003) Training & Racing with a Power Meter.',
    explanation: {
      en: 'Normalized Power (NP) — a physiologically weighted average power. Higher than average when effort is variable. Used to compute TSS and IF.',
      tr: 'Normalize Güç (NG) — fizyolojik olarak ağırlıklandırılmış ortalama güç. Değişken çabalarda ortalamadan yüksektir. TSS ve IF hesaplamak için kullanılır.',
    },
  },
  wprime: {
    citation: 'Skiba P.F. et al. (2012) Med Sci Sports Exerc 44:1526–1532.',
    explanation: {
      en: "W' balance — how much anaerobic work capacity remains. Depletes above CP, reconstitutes below CP. W'=0 means exhaustion.",
      tr: "W' dengesi — kalan anaerobik iş kapasitesi. KB üzerinde azalır, altında yenilenir. W'=0 tükenme anlamına gelir.",
    },
  },
}

export function ACWRExplainer({ value }) {
  return <MetricExplainer metricKey="acwr" value={value} {...METRIC_DEFS.acwr} />
}

export function CTLExplainer({ value }) {
  return <MetricExplainer metricKey="ctl" value={value} {...METRIC_DEFS.ctl} />
}

export function ATLExplainer({ value }) {
  return <MetricExplainer metricKey="atl" value={value} {...METRIC_DEFS.atl} />
}

export function TSBExplainer({ value }) {
  return <MetricExplainer metricKey="tsb" value={value} {...METRIC_DEFS.tsb} />
}

export function DecouplingExplainer({ value }) {
  return <MetricExplainer metricKey="decoupling" value={value != null ? `${value.toFixed(1)}%` : null} {...METRIC_DEFS.decoupling} />
}

export function MonotonyExplainer({ value }) {
  return <MetricExplainer metricKey="monotony" value={value} {...METRIC_DEFS.monotony} />
}

export function NPExplainer({ value }) {
  return <MetricExplainer metricKey="np" value={value != null ? `${value}W` : null} {...METRIC_DEFS.np} />
}

export function WPrimeExplainer({ value }) {
  return <MetricExplainer metricKey="w'" value={value != null ? `${(value / 1000).toFixed(1)} kJ` : null} {...METRIC_DEFS.wprime} />
}
