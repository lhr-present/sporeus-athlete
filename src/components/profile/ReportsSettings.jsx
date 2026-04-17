// ─── ReportsSettings.jsx — email_reports opt-in + auto-generation settings ────
import { useState, useEffect } from 'react'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'
import { S } from '../../styles.js'

export default function ReportsSettings({ authUser }) {
  const [emailReports, setEmailReports] = useState(false)
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [loadError, setLoadError]       = useState(null)

  useEffect(() => {
    if (!isSupabaseReady() || !authUser) return
    supabase.from('profiles')
      .select('email_reports')
      .eq('id', authUser.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { setLoadError(error.message); return }
        if (data) setEmailReports(!!data.email_reports)
      })
  }, [authUser?.id])

  const handleToggle = async (checked) => {
    if (!isSupabaseReady() || !authUser) return
    setEmailReports(checked)
    setSaving(true)
    setSaved(false)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ email_reports: checked })
        .eq('id', authUser.id)
      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      logger.warn('ReportsSettings toggle:', e.message)
      setEmailReports(!checked)   // revert
    } finally {
      setSaving(false)
    }
  }

  if (!isSupabaseReady() || !authUser) {
    return (
      <div style={{ ...S.mono, fontSize: '11px', color: '#555', padding: '12px 0' }}>
        Sign in to manage report settings.
      </div>
    )
  }

  return (
    <div style={{ marginTop: '8px' }}>
      {loadError && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#c0392b', marginBottom: '10px' }}>
          ⚠ {loadError}
        </div>
      )}

      {/* Email delivery toggle */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ ...S.label, marginBottom: '6px' }}>EMAIL REPORT DELIVERY</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={emailReports}
            onChange={e => handleToggle(e.target.checked)}
            disabled={saving}
            style={{ accentColor: '#ff6600', width: 14, height: 14 }}
          />
          <span style={{ ...S.mono, fontSize: '11px', color: emailReports ? 'var(--text)' : '#555' }}>
            {emailReports
              ? 'Enabled — weekly PDF sent every Monday'
              : 'Disabled — reports available in the Reports tab only'}
          </span>
          {saved && <span style={{ ...S.mono, fontSize: '10px', color: '#2d8c2d' }}>✓ Saved</span>}
          {saving && <span style={{ ...S.mono, fontSize: '10px', color: '#888' }}>…</span>}
        </label>
        <div style={{ ...S.mono, fontSize: '9px', color: '#444', marginTop: '4px', lineHeight: 1.6 }}>
          Weekly reports are generated automatically every Sunday at 22:00 UTC.
          Monthly squad reports are generated on the 1st of each month (Coach tier required).
        </div>
      </div>

      {/* Auto-generation schedule info */}
      <div style={{ backgroundColor: 'var(--surface, #111)', border: '1px solid #222', borderRadius: '4px', padding: '10px 12px' }}>
        <div style={{ ...S.mono, fontSize: '8px', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
          Auto-Generation Schedule
        </div>
        {[
          { icon: '◈', label: 'Weekly Training Report', schedule: 'Every Sunday 22:00 UTC → available Monday', tier: 'all tiers' },
          { icon: '▲', label: 'Race Readiness Report',  schedule: 'On-demand only (use Reports tab)',        tier: 'Coach+' },
          { icon: '▦', label: 'Monthly Squad Report',   schedule: 'Every 1st of month 06:00 UTC',           tier: 'Club (coaches only)' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
            <span style={{ ...S.mono, fontSize: '12px', color: '#ff6600', flexShrink: 0 }}>{item.icon}</span>
            <div>
              <div style={{ ...S.mono, fontSize: '10px', color: 'var(--text)' }}>{item.label}</div>
              <div style={{ ...S.mono, fontSize: '8px', color: '#555', marginTop: '2px' }}>{item.schedule}</div>
              <div style={{ ...S.mono, fontSize: '8px', color: '#444', marginTop: '1px' }}>Tier: {item.tier}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
