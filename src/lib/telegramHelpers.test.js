import { describe, it, expect } from 'vitest'
import { buildTelegramPayload, validateTelegramType, shouldSendTelegram } from './telegramHelpers.js'

describe('buildTelegramPayload', () => {
  it('valid chatId and message → correct payload object', () => {
    const result = buildTelegramPayload('123456', 'Hello', 'coach_alert')
    expect(result).toEqual({ chat_id: '123456', text: 'Hello', parse_mode: 'HTML' })
  })

  it('null chatId → null', () => {
    expect(buildTelegramPayload(null, 'Hello', 'coach_alert')).toBeNull()
  })

  it('empty message → null', () => {
    expect(buildTelegramPayload('123', '', 'coach_alert')).toBeNull()
  })
})

describe('validateTelegramType', () => {
  it('"weekly_digest" → true; "spam" → false', () => {
    expect(validateTelegramType('weekly_digest')).toBe(true)
    expect(validateTelegramType('spam')).toBe(false)
  })
})

describe('shouldSendTelegram', () => {
  it('valid telegram_chat_id and dailyCount < maxPerDay → true', () => {
    expect(shouldSendTelegram({ telegram_chat_id: 'abc' }, 1, 2)).toBe(true)
  })

  it('null telegram_chat_id → false', () => {
    expect(shouldSendTelegram({ telegram_chat_id: null }, 0, 2)).toBe(false)
  })
})
