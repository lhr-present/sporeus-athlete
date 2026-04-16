// ─── lib/db/orgBranding.js — Club-tier org branding helpers ──────────────────
import { supabase, isSupabaseReady } from '../supabase.js'
import { logger } from '../logger.js'

const LS_KEY = 'sporeus-club-profile'

/** @typedef {{ orgName: string, primaryColor: string, logoUrl?: string }} ClubProfile */

/**
 * Load club profile from localStorage (fast, synchronous).
 * @returns {ClubProfile}
 */
export function getLocalClubProfile() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || 'null') || { orgName: '', primaryColor: '#ff6600' }
  } catch (e) {
    logger.warn('localStorage:', e.message)
    return { orgName: '', primaryColor: '#ff6600' }
  }
}

/**
 * Save club profile to localStorage.
 * @param {ClubProfile} profile
 */
export function saveLocalClubProfile(profile) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(profile))
  } catch (e) {
    logger.warn('localStorage:', e.message)
  }
}

/**
 * Upsert org branding row in Supabase (Club-tier only).
 * @param {string} orgId — auth.uid() of the club owner
 * @param {ClubProfile} profile
 * @returns {Promise<{ error: object|null }>}
 */
export async function upsertOrgBranding(orgId, profile) {
  if (!isSupabaseReady() || !orgId) return { error: null }
  try {
    const { error } = await supabase.from('org_branding').upsert({
      org_id:        orgId,
      app_name:      profile.orgName   || 'Sporeus Athlete',
      primary_color: profile.primaryColor || '#ff6600',
      logo_url:      profile.logoUrl   || null,
    }, { onConflict: 'org_id' })
    if (error) logger.error('db:', error.message)
    return { error }
  } catch (e) {
    logger.error('db:', e.message)
    return { error: e }
  }
}

/**
 * Fetch org branding from Supabase.
 * @param {string} orgId
 * @returns {Promise<{ data: ClubProfile|null, error: object|null }>}
 */
export async function getOrgBranding(orgId) {
  if (!isSupabaseReady() || !orgId) return { data: null, error: null }
  try {
    const { data, error } = await supabase
      .from('org_branding')
      .select('app_name, primary_color, logo_url')
      .eq('org_id', orgId)
      .maybeSingle()
    if (error) { logger.error('db:', error.message); return { data: null, error } }
    if (!data) return { data: null, error: null }
    return {
      data: { orgName: data.app_name, primaryColor: data.primary_color, logoUrl: data.logo_url },
      error: null,
    }
  } catch (e) {
    logger.error('db:', e.message)
    return { data: null, error: e }
  }
}
