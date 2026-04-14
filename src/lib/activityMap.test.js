// ─── activityMap.test.js — Tests for decodePolyline + haversine ───────────────
import { describe, it, expect } from 'vitest'
import { decodePolyline, haversine } from '../components/ActivityMap.jsx'

// ── decodePolyline ────────────────────────────────────────────────────────────

describe('decodePolyline', () => {
  it('decodes a known encoded polyline correctly', () => {
    // _p~iF~ps|U_ulLnnqC_mqNvxq` from Google's documentation
    // Represents: (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`'
    const result  = decodePolyline(encoded)
    expect(result).toHaveLength(3)
    expect(result[0][0]).toBeCloseTo(38.5,  1)
    expect(result[0][1]).toBeCloseTo(-120.2, 1)
    expect(result[1][0]).toBeCloseTo(40.7,  1)
    expect(result[2][0]).toBeCloseTo(43.252, 2)
  })

  it('returns empty array for empty string', () => {
    expect(decodePolyline('')).toEqual([])
  })

  it('returns empty array for null input', () => {
    expect(decodePolyline(null)).toEqual([])
  })

  it('output array contains [lat, lon] number pairs', () => {
    const encoded = '_p~iF~ps|U'  // single point
    const result  = decodePolyline(encoded)
    expect(result).toHaveLength(1)
    expect(typeof result[0][0]).toBe('number')
    expect(typeof result[0][1]).toBe('number')
  })
})

// ── haversine ─────────────────────────────────────────────────────────────────

describe('haversine', () => {
  it('returns ~0 for identical points', () => {
    expect(haversine(51.5, -0.1, 51.5, -0.1)).toBe(0)
  })

  it('approximates London to Paris (~340 km)', () => {
    // London: 51.5074, -0.1278 | Paris: 48.8566, 2.3522
    const dist = haversine(51.5074, -0.1278, 48.8566, 2.3522)
    expect(dist).toBeGreaterThan(340000)
    expect(dist).toBeLessThan(345000)
  })

  it('is symmetric (A→B equals B→A)', () => {
    const d1 = haversine(40.0, -74.0, 41.0, -73.0)
    const d2 = haversine(41.0, -73.0, 40.0, -74.0)
    expect(d1).toBeCloseTo(d2, 0)
  })

  it('returns meters (equator 1° lon ≈ 111km)', () => {
    const dist = haversine(0, 0, 0, 1)  // 1 degree of longitude at equator
    expect(dist).toBeGreaterThan(110000)
    expect(dist).toBeLessThan(112000)
  })
})
