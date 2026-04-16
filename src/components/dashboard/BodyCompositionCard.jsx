// ─── dashboard/BodyCompositionCard.jsx — body fat / BMI / BMR panel ──────────
import { S } from '../../styles.js'
import { useData } from '../../contexts/DataContext.jsx'
import { navyBF, mifflinBMR } from '../../lib/formulas.js'

export default function BodyCompositionCard({ dl }) {
  const { profile } = useData()

  if (!dl.body) return null

  const h    = parseFloat(profile.height || 0)
  const w    = parseFloat(profile.weight || 0)
  const a    = parseFloat(profile.age    || 0)
  const g    = profile.gender || 'male'
  const n    = parseFloat(profile.neck  || 0)
  const wa   = parseFloat(profile.waist || 0)
  const hi_p = parseFloat(profile.hip   || 0)

  const bf  = (n && wa && h) ? navyBF(n, wa, hi_p, h, g) : null
  const bmi = (w && h) ? Math.round(w / (h / 100) ** 2 * 10) / 10 : null
  const bmr = (w && h && a) ? mifflinBMR(w, h, a, g) : null

  if (!bf && !bmi) return null

  const bfColor = g === 'male'
    ? (bf < 10 ? '#4a90d9' : bf < 20 ? '#5bc25b' : bf < 25 ? '#f5c542' : '#e03030')
    : (bf < 20 ? '#4a90d9' : bf < 28 ? '#5bc25b' : bf < 35 ? '#f5c542' : '#e03030')

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '198ms' }}>
      <div style={S.cardTitle}>BODY COMPOSITION</div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {bf !== null && (
          <div>
            <div style={{ ...S.mono, fontSize: '9px', color: '#888' }}>BODY FAT (NAVY)</div>
            <div style={{ ...S.mono, fontSize: '22px', fontWeight: 600, color: bfColor }}>{bf}%</div>
          </div>
        )}
        {bmi !== null && (
          <div>
            <div style={{ ...S.mono, fontSize: '9px', color: '#888' }}>BMI</div>
            <div style={{ ...S.mono, fontSize: '22px', fontWeight: 600, color: bmi < 18.5 || bmi >= 30 ? '#e03030' : bmi < 25 ? '#5bc25b' : '#f5c542' }}>{bmi}</div>
          </div>
        )}
        {bmr !== null && (
          <div>
            <div style={{ ...S.mono, fontSize: '9px', color: '#888' }}>BMR (TDEE@1.55)</div>
            <div style={{ ...S.mono, fontSize: '22px', fontWeight: 600, color: 'var(--text)' }}>{Math.round(bmr * 1.55)}</div>
            <div style={{ ...S.mono, fontSize: '9px', color: '#aaa' }}>kcal/day</div>
          </div>
        )}
      </div>
    </div>
  )
}
