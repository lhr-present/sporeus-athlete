import { describe, it, expect } from 'vitest'
import { parseCheckinPayload } from '../components/QRScanner.jsx'
import { buildQrPayload } from '../components/coach/SessionQRModal.jsx'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('buildQrPayload', () => {
  it('generates correct prefix + uuid', () => {
    expect(buildQrPayload(VALID_UUID)).toBe(`sporeus:checkin:${VALID_UUID}`)
  })
})

describe('parseCheckinPayload', () => {
  it('returns sessionId for valid payload', () => {
    expect(parseCheckinPayload(`sporeus:checkin:${VALID_UUID}`)).toBe(VALID_UUID)
  })

  it('returns null for wrong prefix', () => {
    expect(parseCheckinPayload(`foo:checkin:${VALID_UUID}`)).toBeNull()
  })

  it('returns null for non-UUID suffix', () => {
    expect(parseCheckinPayload('sporeus:checkin:not-a-uuid-at-all')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseCheckinPayload('')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(parseCheckinPayload(null)).toBeNull()
  })

  it('round-trips with buildQrPayload', () => {
    const payload = buildQrPayload(VALID_UUID)
    expect(parseCheckinPayload(payload)).toBe(VALID_UUID)
  })
})
