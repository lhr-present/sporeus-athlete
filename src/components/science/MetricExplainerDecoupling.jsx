// src/components/science/MetricExplainerDecoupling.jsx
// E12 — Pre-wired MetricExplainer for aerobic decoupling metrics.
// Extends the E3 MetricExplainer pattern with new E12 science metrics.

import MetricExplainer from './MetricExplainer.jsx'

// ── Metric definitions ────────────────────────────────────────────────────────

const DEFS = {
  ef: {
    citation: 'Coggan A.R. (2003) Training & Racing with a Power Meter; Allen & Coggan (2010) 2nd ed.',
    explanation: {
      en: 'Efficiency Factor (EF) = Normalized Power ÷ avg HR (cycling) or pace ÷ avg HR (running). A rising EF over 4–6 weeks signals aerobic adaptation. Typical range: 1.4–2.0 (cycling), 1.8–3.0 (running).',
      tr: 'Verimlilik Faktörü (VF) = Normalize Güç ÷ ort. KAH (bisiklet) veya tempo ÷ ort. KAH (koşu). 4–6 haftada artan VF aerobik adaptasyonu gösterir. Tipik aralık: 1.4–2.0 (bisiklet), 1.8–3.0 (koşu).',
    },
  },
  efTrend: {
    citation: 'Coggan A.R. (2003) Training & Racing with a Power Meter.',
    explanation: {
      en: 'EF trend over a 30-day rolling window (≥8 sessions required). Improving = EF rose ≥2%; Declining = fell ≥2%; Stable = within ±2%. Low CV (<5%) confirms a clean signal.',
      tr: '30 günlük yuvarlanma penceresinde VF trendi (en az 8 antrenman gerekli). İyileşme = VF ≥%2 artış; Gerileme = ≥%2 düşüş; Stabil = ±%2 içinde. Düşük CV (<%5) güvenilir sinyal anlamına gelir.',
    },
  },
  durability: {
    citation: 'Maunder E. et al. (2021) Sports Med 51:1523–1550.',
    explanation: {
      en: "Durability = last-hour 5-min peak power ÷ rested 5-min MMP × 100. Measures how much power output is preserved late in long efforts. ≥95% = high; 90–95% = moderate; 85–90% = low; <85% = very low. Only valid for sessions ≥90 min.",
      tr: 'Dayanıklılık = son saat 5 dk zirve güç ÷ dinlenmiş 5 dk MMP × 100. Uzun çabalar sırasında güç çıkışının ne kadar korunduğunu ölçer. ≥%95 = yüksek; %90–95 = orta; %85–90 = düşük; <%85 = çok düşük. Yalnızca ≥90 dk oturumlar için geçerlidir.',
    },
  },
  subThreshold: {
    citation: 'Seiler S. (2010) Int J Sports Physiol Perform 5(3):276–291.',
    explanation: {
      en: 'Sub-threshold time = minutes per week in Zone 1+2 (below VT2/LT2). The polarized model (Seiler 2010) prescribes ~80% of training time below threshold. Consistently low values signal insufficient aerobic base building.',
      tr: 'Eşik-altı süre = haftada Z1+Z2 (VT2/LT2 altı) dakikası. Polarize model (Seiler 2010) antrenman süresinin ~%80\'inin eşik altında olmasını önerir. Sürekli düşük değerler yetersiz aerobik baz çalışmasına işaret eder.',
    },
  },
}

// ── Pre-wired components ──────────────────────────────────────────────────────

/**
 * Efficiency Factor info button.
 * @param {{ value?: number }} props
 */
export function EFExplainer({ value }) {
  return (
    <MetricExplainer
      metricKey="ef"
      value={value != null ? value.toFixed(3) : null}
      {...DEFS.ef}
    />
  )
}

/**
 * EF Trend info button.
 * @param {{ trend?: 'improving'|'stable'|'declining', changePercent?: number }} props
 */
export function EFTrendExplainer({ trend, changePercent }) {
  const displayValue = trend != null && changePercent != null
    ? `${trend} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%)`
    : null
  return (
    <MetricExplainer
      metricKey="efTrend"
      value={displayValue}
      {...DEFS.efTrend}
    />
  )
}

/**
 * Durability score info button.
 * @param {{ value?: number, tier?: string }} props
 */
export function DurabilityExplainer({ value, tier }) {
  const displayValue = value != null ? `${value.toFixed(1)}%${tier ? ` (${tier})` : ''}` : null
  return (
    <MetricExplainer
      metricKey="durability"
      value={displayValue}
      {...DEFS.durability}
    />
  )
}

/**
 * Sub-threshold time info button.
 * @param {{ minutes?: number }} props
 */
export function SubThresholdExplainer({ minutes }) {
  const displayValue = minutes != null ? `${minutes} min` : null
  return (
    <MetricExplainer
      metricKey="subThreshold"
      value={displayValue}
      {...DEFS.subThreshold}
    />
  )
}
