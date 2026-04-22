// ─── dashboard/ZoneDistributorCard.jsx — zone balance + training model badge ──
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { zoneDistribution, trainingModel, MODEL_META } from '../../lib/zoneDistrib.js'

const ZONE_COLORS = ['#5bc25b', '#0064ff', '#f5c542', '#ff6600', '#e03030']
const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

/**
 * @param {{ filteredLog: object[], rangeLabel: string }} props
 */
export default function ZoneDistributorCard({ filteredLog, rangeLabel }) {
  const [lang] = useLocalStorage('sporeus-lang', 'en')

  if (!filteredLog.length) return null

  const dist = zoneDistribution(filteredLog)
  if (!dist) return null

  const model = trainingModel(dist)
  const meta  = MODEL_META[model] || MODEL_META.mixed
  const zones = [1, 2, 3, 4, 5]

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '188ms' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div style={S.cardTitle}>ZONE DISTRIBUTOR · <span style={{ color: '#ff6600' }}>{rangeLabel}</span></div>
        <span style={{ ...S.mono, fontSize: 10, fontWeight: 700, color: meta.color, border: `1px solid ${meta.color}44`, borderRadius: 2, padding: '2px 8px' }}>
          {lang === 'tr' ? meta.tr : meta.en}
        </span>
      </div>
      <div style={{ display: 'flex', width: '100%', height: 14, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
        {zones.map((z, i) => dist[z] > 0 && (
          <div key={z} style={{ width: `${dist[z]}%`, background: ZONE_COLORS[i], transition: 'width 0.3s' }} title={`Z${z}: ${dist[z]}%`}/>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        {zones.map((z, i) => (
          <div key={z} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 1, background: ZONE_COLORS[i] }}/>
            <span style={{ ...S.mono, fontSize: 9, color: dist[z] > 0 ? ZONE_COLORS[i] : '#444' }}>
              {ZONE_LABELS[i]} {dist[z]}%
            </span>
          </div>
        ))}
      </div>
      <div style={{ ...S.mono, fontSize: 9, color: '#666', lineHeight: 1.5 }}>
        {lang === 'tr' ? meta.tipTr : meta.tip}
      </div>
    </div>
  )
}
