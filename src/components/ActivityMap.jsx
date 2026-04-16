// ─── ActivityMap.jsx — GPX route visualization: Leaflet map + elevation profile ─
import { useEffect, useRef, useState } from 'react'

const MONO = "'IBM Plex Mono', monospace"

// ── Haversine distance (meters between two lat/lon points) ────────────────────
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000  // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Google Encoded Polyline decoder ──────────────────────────────────────────
export function decodePolyline(encoded) {
  if (!encoded) return []
  const result = []
  let index = 0, lat = 0, lon = 0
  while (index < encoded.length) {
    let shift = 0, b, r = 0
    do { b = encoded.charCodeAt(index++) - 63; r |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (r & 1 ? ~(r >> 1) : r >> 1)
    shift = 0; r = 0
    do { b = encoded.charCodeAt(index++) - 63; r |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lon += (r & 1 ? ~(r >> 1) : r >> 1)
    result.push([lat * 1e-5, lon * 1e-5])
  }
  return result
}

// ── Lerp colour between two hex colours ───────────────────────────────────────
function lerpColor(lo, hi, t) {
  const parse  = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
  const [r1, g1, b1] = parse(lo)
  const [r2, g2, b2] = parse(hi)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r},${g},${b})`
}

// ── Elevation Profile (pure SVG, no library) ──────────────────────────────────
function ElevationProfile({ trackpoints }) {
  if (!trackpoints || trackpoints.length < 2) return null

  // Build cumulative distance array
  let cumDist = 0
  const pts = trackpoints.map((p, i) => {
    if (i > 0) {
      const prev = trackpoints[i - 1]
      cumDist += haversine(prev.lat, prev.lon, p.lat, p.lon)
    }
    return { dist: cumDist / 1000, ele: p.ele || 0 }
  })

  const maxDist = pts[pts.length - 1].dist || 1
  const eles    = pts.map(p => p.ele)
  const minEle  = Math.min(...eles)
  const maxEle  = Math.max(...eles, minEle + 1)

  const W = 100, H = 30
  const toX = d  => (d / maxDist) * W
  const toY = el => H - ((el - minEle) / (maxEle - minEle)) * H

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.dist).toFixed(1)},${toY(p.ele).toFixed(1)}`).join(' ')
  const areaD = `${pathD} L${toX(maxDist).toFixed(1)},${H} L0,${H} Z`

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ fontFamily: MONO, fontSize: '8px', color: '#555', letterSpacing: '0.08em', marginBottom: '3px' }}>
        ELEVATION PROFILE · {Math.round(maxDist * 10) / 10}km
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0064ff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0064ff" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#elevGrad)" />
        <path d={pathD} fill="none" stroke="#0064ff" strokeWidth="0.8" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '8px', color: '#444', marginTop: '2px' }}>
        <span>0 km</span>
        <span>{Math.round(minEle)}m — {Math.round(maxEle)}m</span>
        <span>{Math.round(maxDist * 10) / 10} km</span>
      </div>
    </div>
  )
}

// ── ActivityMap ───────────────────────────────────────────────────────────────

/**
 * ActivityMap — renders a Leaflet map with the route polyline coloured by elevation.
 * Shows start (green) and finish (checkered) markers. Elevation profile below the map.
 * @param {object} props
 * @param {Array<{lat:number,lon:number,ele:number,time?:string}>} props.trackpoints
 * @param {function} props.onClose — () => void
 */
export default function ActivityMap({ trackpoints, onClose: _onClose }) {
  const mapRef  = useRef(null)
  const leafRef = useRef(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!trackpoints || trackpoints.length < 2) { setLoading(false); return }

    let L
    let mounted = true

    async function init() {
      try {
        // Lazy-load Leaflet CSS + JS
        if (!document.querySelector('link[href*="leaflet"]')) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          document.head.appendChild(link)
        }
        L = await import('https://esm.sh/leaflet@1.9.4')
        L = L.default || L

        if (!mounted || !mapRef.current) return

        // Compute bounding box
        const lats = trackpoints.map(p => p.lat)
        const lons = trackpoints.map(p => p.lon)
        const bounds = [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]]

        const map = L.map(mapRef.current, { zoomControl: true })
        leafRef.current = map

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18,
        }).addTo(map)

        map.fitBounds(bounds, { padding: [20, 20] })

        // Elevation-coloured polyline segments
        const eles = trackpoints.map(p => p.ele || 0)
        const minEle = Math.min(...eles)
        const maxEle = Math.max(...eles, minEle + 1)

        for (let i = 0; i < trackpoints.length - 1; i++) {
          const t = (eles[i] - minEle) / (maxEle - minEle)
          const color = lerpColor('#0064ff', '#e03030', t)
          L.polyline([[trackpoints[i].lat, trackpoints[i].lon], [trackpoints[i + 1].lat, trackpoints[i + 1].lon]], {
            color, weight: 3, opacity: 0.85,
          }).addTo(map)
        }

        // Start marker (green circle)
        const start = trackpoints[0]
        L.circleMarker([start.lat, start.lon], {
          radius: 7, fillColor: '#5bc25b', fillOpacity: 1, color: '#fff', weight: 2,
        }).addTo(map).bindPopup('Start')

        // Finish marker (orange circle)
        const finish = trackpoints[trackpoints.length - 1]
        L.circleMarker([finish.lat, finish.lon], {
          radius: 7, fillColor: '#ff6600', fillOpacity: 1, color: '#fff', weight: 2,
        }).addTo(map).bindPopup('Finish')

        if (mounted) setLoading(false)
      } catch (e) {
        if (mounted) { setError('Map failed to load — check your internet connection.'); setLoading(false) }
      }
    }

    init()
    return () => {
      mounted = false
      if (leafRef.current) { leafRef.current.remove(); leafRef.current = null }
    }
  }, [trackpoints])

  if (!trackpoints || trackpoints.length < 2) {
    return (
      <div style={{ padding: '20px', fontFamily: MONO, fontSize: '11px', color: '#888' }}>
        No route data for this activity.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Map container */}
      <div style={{ position: 'relative', flex: '1 1 240px' }}>
        <div ref={mapRef} style={{ width: '100%', height: '240px', background: '#1a1a1a', borderRadius: '4px' }} />
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: '10px', color: '#555' }}>
            Loading map…
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: '10px', color: '#e03030', padding: '20px', textAlign: 'center' }}>
            {error}
          </div>
        )}
      </div>

      {/* Elevation profile */}
      <ElevationProfile trackpoints={trackpoints} />

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: '8px', color: '#0064ff' }}>◼ Low elevation</span>
        <span style={{ fontFamily: MONO, fontSize: '8px', color: '#e03030' }}>◼ High elevation</span>
        <span style={{ fontFamily: MONO, fontSize: '8px', color: '#5bc25b' }}>● Start</span>
        <span style={{ fontFamily: MONO, fontSize: '8px', color: '#ff6600' }}>● Finish</span>
      </div>
    </div>
  )
}
