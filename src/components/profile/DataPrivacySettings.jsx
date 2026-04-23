import { useState, useEffect, useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'

export default function DataPrivacySettings({ authUser }) {
  const { t } = useContext(LangCtx)

  const [exportState, setExportState]       = useState(null)   // null|'loading'|'done'|'error'
  const [exportUrl, setExportUrl]           = useState(null)
  const [showModal, setShowModal]           = useState(false)
  const [pendingDel, setPendingDel]         = useState(null)   // data_rights_requests row
  const [delState, setDelState]             = useState(null)   // null|'loading'|'scheduled'|'error'
  const [cancelState, setCancelState]       = useState(null)   // null|'loading'|'done'|'error'

  // Load any active pending deletion request
  useEffect(() => {
    if (!authUser?.id || !isSupabaseReady()) return
    supabase
      .from('data_rights_requests')
      .select('id, status, scheduled_purge_at')
      .eq('user_id', authUser.id)
      .eq('kind', 'deletion')
      .in('status', ['pending', 'processing'])
      .maybeSingle()
      .then(({ data }) => { if (data) setPendingDel(data) })
      .catch(e => logger.warn('drr load:', e.message))
  }, [authUser?.id])

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!authUser?.id) return
    setExportState('loading')
    try {
      const { data, error } = await supabase.functions.invoke('export-user-data', {
        method: 'POST',
      })
      if (error) throw error
      if (data?.download_url) {
        setExportUrl(data.download_url)
        window.open(data.download_url, '_blank')
      }
      setExportState('done')
      setTimeout(() => setExportState(null), 5000)
    } catch (e) {
      logger.warn('export:', e.message)
      setExportState('error')
      setTimeout(() => setExportState(null), 3000)
    }
  }

  // ── Delete — confirmed from modal ─────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!authUser?.id) return
    setShowModal(false)
    setDelState('loading')
    try {
      const purgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('data_rights_requests')
        .insert({
          user_id:            authUser.id,
          kind:               'deletion',
          status:             'pending',
          scheduled_purge_at: purgeAt,
        })
        .select('id, scheduled_purge_at')
        .single()
      if (error) throw error
      setPendingDel(data)
      setDelState('scheduled')
    } catch (e) {
      logger.warn('delete request:', e.message)
      setDelState('error')
      setTimeout(() => setDelState(null), 3000)
    }
  }

  // ── Cancel deletion ───────────────────────────────────────────────────────
  const handleCancelDelete = async () => {
    if (!pendingDel) return
    setCancelState('loading')
    try {
      const { error } = await supabase
        .from('data_rights_requests')
        .update({ status: 'canceled' })
        .eq('id', pendingDel.id)
        .eq('user_id', authUser.id)
      if (error) throw error
      setPendingDel(null)
      setDelState(null)
      setCancelState('done')
      setTimeout(() => setCancelState(null), 3000)
    } catch (e) {
      logger.warn('cancel delete:', e.message)
      setCancelState('error')
      setTimeout(() => setCancelState(null), 3000)
    }
  }

  const purgeDate = pendingDel?.scheduled_purge_at
    ? new Date(pendingDel.scheduled_purge_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null

  return (
    <div>
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '10px' }}>
        {t('privTitle')}
      </div>

      {/* Pending deletion banner */}
      {pendingDel && (
        <div style={{
          background:   '#1a0505',
          border:       '1px solid #5a1515',
          borderRadius: '4px',
          padding:      '10px 12px',
          marginBottom: '12px',
        }}>
          <div style={{ ...S.mono, fontSize: '10px', color: '#e07070', marginBottom: '8px' }}>
            {t('privDeleteBanner').replace('{date}', purgeDate ?? '…')}
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#888', marginBottom: '8px' }}>
            {t('privGraceNote')}
          </div>
          <button
            style={{ ...S.btnSec, fontSize: '9px', padding: '4px 12px', color: '#e07070', borderColor: '#5a1515' }}
            disabled={cancelState === 'loading'}
            onClick={handleCancelDelete}
          >
            {cancelState === 'loading' ? '…'
              : cancelState === 'done' ? t('privCancelConfirm', '✓ Cancelled')
              : t('privCancelDeletion')}
          </button>
        </div>
      )}

      {/* Export + Delete buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
        <button
          style={{ ...S.btnSec, fontSize: '9px', padding: '4px 12px' }}
          disabled={exportState === 'loading'}
          onClick={handleExport}
        >
          {exportState === 'loading' ? t('privExportBtnLoading')
            : exportState === 'done' ? t('privExportBtnDone')
            : exportState === 'error' ? '✗ Error'
            : t('privExportBtn')}
        </button>

        {!pendingDel && (
          <button
            style={{ ...S.btnSec, fontSize: '9px', padding: '4px 12px', color: '#e03030', borderColor: '#e03030' }}
            disabled={delState === 'loading' || delState === 'scheduled'}
            onClick={() => setShowModal(true)}
          >
            {delState === 'loading' ? '…'
              : delState === 'error' ? '✗ Error'
              : t('privDeleteBtn')}
          </button>
        )}
      </div>

      <div style={{ ...S.mono, fontSize: '9px', color: '#444', lineHeight: 1.6 }}>
        {t('privExportNote')}
      </div>

      {/* Two-step deletion confirmation modal */}
      {showModal && (
        <div style={{
          position:        'fixed',
          inset:           0,
          background:      'rgba(0,0,0,0.8)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          zIndex:          9999,
          padding:         '16px',
        }}>
          <div style={{
            background:   'var(--card-bg, #111)',
            border:       '1px solid #3a0000',
            borderRadius: '6px',
            padding:      '24px',
            maxWidth:     '420px',
            width:        '100%',
          }}>
            <div style={{ ...S.mono, fontSize: '11px', color: '#e07070', fontWeight: 700, marginBottom: '14px', letterSpacing: '0.08em' }}>
              {t('privDeleteModalTitle')}
            </div>
            <div style={{ ...S.mono, fontSize: '10px', color: '#aaa', lineHeight: 1.7, marginBottom: '18px' }}>
              {t('privDeleteModalBody')}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                style={{ ...S.btnSec, fontSize: '9px', padding: '5px 14px' }}
                onClick={() => setShowModal(false)}
              >
                {t('privDeleteCancel')}
              </button>
              <button
                style={{ ...S.btnSec, fontSize: '9px', padding: '5px 14px', color: '#e03030', borderColor: '#e03030' }}
                onClick={handleDeleteConfirm}
              >
                {t('privDeleteConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
