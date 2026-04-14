// ─── consent.js — GDPR consent record helpers ─────────────────────────────────
import { supabase } from '../supabase.js'

const VALID_CONSENT_TYPES = ['data_processing', 'health_data', 'marketing']

// ── validateConsentType ────────────────────────────────────────────────────────
// Returns true if type is one of the allowed consent types, false otherwise.
export function validateConsentType(type) {
  return VALID_CONSENT_TYPES.includes(type)
}

// ── formatConsentRecord ────────────────────────────────────────────────────────
// Returns a consent record object ready for DB insertion.
// Returns null if consentType is invalid.
export function formatConsentRecord(userId, consentType, version) {
  if (!validateConsentType(consentType)) return null
  return {
    user_id:      userId,
    consent_type: consentType,
    version,
    granted_at:   new Date().toISOString(),
    ip_address:   null,
  }
}

// ── logConsent ────────────────────────────────────────────────────────────────
// Inserts a consent record into the 'consents' Supabase table.
// Returns { data: null, error: 'NOT_CONFIGURED' } if supabase is null.
export async function logConsent(userId, consentType, version) {
  if (!supabase) return { data: null, error: 'NOT_CONFIGURED' }
  const record = formatConsentRecord(userId, consentType, version)
  if (!record) return { data: null, error: 'INVALID_CONSENT_TYPE' }
  return supabase.from('consents').insert(record).select()
}

// ── getLatestConsent ───────────────────────────────────────────────────────────
// Returns the most recent consent record for the given user and consent type.
// Returns null if supabase is not configured or no record is found.
export async function getLatestConsent(userId, consentType) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('consents')
    .select('*')
    .eq('user_id', userId)
    .eq('consent_type', consentType)
    .order('granted_at', { ascending: false })
    .limit(1)
  if (error || !data || data.length === 0) return null
  return data[0]
}
