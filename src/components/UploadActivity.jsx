// ─── UploadActivity.jsx — Server-side FIT/GPX upload + parse ─────────────────
// Drag-and-drop FIT/GPX upload → Supabase Storage → parse-activity edge function
// Shows progress stages: idle → uploading → pending → parsing → done | error
// Free tier: 5 uploads/month enforced client-side (server also enforces).

import { useState, useCallback, useContext, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { canUploadFile, FREE_UPLOAD_LIMIT, getTierSync, getUpgradePrompt } from '../lib/subscription.js'
import { logger } from '../lib/logger.js'
import { S } from '../styles.js'

const MAX_BYTES  = 26_214_400          // 25 MB (must match edge fn + bucket)
const PARSE_TIMEOUT_MS = 90_000        // watchdog: edge fn 200s but no terminal status written
const BUCKET     = 'activity-uploads'
const ACCEPT_EXT = { 'application/octet-stream': ['.fit'], 'text/xml': ['.gpx'], 'application/xml': ['.gpx'] }

const STATUS_LABEL_KEY = {
  idle:      null,
  uploading: 'upload_statusUploading',
  pending:   'upload_statusPending',
  parsing:   'upload_statusParsing',
  done:      'upload_statusDone',
  error:     'upload_statusError',
}

const STATUS_COLOR = {
  idle: '#888', uploading: '#0064ff', pending: '#ff6600',
  parsing: '#ff6600', done: '#00c853', error: '#e03030',
}

/**
 * @param {object} props
 * @param {object|null} props.authUser      — from useAuth
 * @param {function}    props.onSuccess     — called with logEntryId on parse done
 * @param {function}    props.onClose       — called when user dismisses
 */
export default function UploadActivity({ authUser, onSuccess, onClose }) {
  const { t } = useContext(LangCtx)
  const [status,   setStatus]  = useState('idle')
  const [errMsg,   setErrMsg]  = useState('')
  const [progress, setProgress] = useState('')
  const [tierBlocked, setTierBlocked] = useState(false)
  const channelRef = useRef(null)
  const watchdogRef = useRef(null)  // flips 'parsing' → 'error' if no terminal status arrives
  const inFlightRef = useRef(false)  // synchronous double-submit guard (status state lags a render)

  // Check free-tier quota on mount
  useEffect(() => {
    if (!authUser || !isSupabaseReady()) return
    supabase
      .from('profiles')
      .select('file_upload_count_month, subscription_tier')
      .eq('id', authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        const tier  = data?.subscription_tier || getTierSync()
        const count = data?.file_upload_count_month ?? 0
        if (!canUploadFile(count, tier)) {
          setTierBlocked(true)
          setErrMsg(getUpgradePrompt('upload_files'))
        }
      })
  }, [authUser])

  // Cleanup realtime + watchdog on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      clearTimeout(watchdogRef.current)
    }
  }, [])

  const processFile = useCallback(async (file) => {
    // Two files dropped in the same tick both see status==='idle' (state lags a
    // render), so the dropzone's disabled prop can't prevent a duplicate upload.
    // This ref blocks the second call synchronously.
    if (inFlightRef.current) return
    if (!authUser || !isSupabaseReady()) {
      setErrMsg(t('upload_errSignIn')); return
    }
    if (file.size > MAX_BYTES) {
      setErrMsg(t('upload_errTooLarge').replace('{mb}', (file.size / 1024 / 1024).toFixed(1))); return
    }
    if (tierBlocked) return

    const ext = file.name.split('.').pop().toLowerCase()
    if (!['fit', 'gpx'].includes(ext)) {
      setErrMsg(t('upload_errUnsupported')); return
    }

    inFlightRef.current = true
    setErrMsg('')
    setStatus('uploading')
    setProgress(t('upload_progUploading'))

    try {
      // 1. Upload raw file to Storage
      const ts   = Date.now()
      const path = `${authUser.id}/${ts}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
      if (upErr) throw new Error(t('upload_errUploadFailed').replace('{msg}', upErr.message))

      setStatus('pending')
      setProgress(t('upload_progCreatingJob'))

      // 2. Insert job row (status='pending')
      const { data: jobRow, error: jobErr } = await supabase
        .from('activity_upload_jobs')
        .insert({
          user_id:   authUser.id,
          file_path: path,
          file_name: file.name,
          file_type: ext,
          file_size: file.size,
          status:    'pending',
        })
        .select('id')
        .maybeSingle()
      if (jobErr || !jobRow) throw new Error(t('upload_errJobFailed').replace('{msg}', jobErr?.message || t('upload_errUnknown')))

      const jobId = jobRow.id

      // 3. Subscribe to realtime updates on this job row
      const ch = supabase
        .channel(`upload-job-${jobId}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'activity_upload_jobs',
          filter: `id=eq.${jobId}`,
        }, ({ new: updated }) => {
          if (!updated) return  // malformed payload (absent `new`) — ignore, don't throw
          if (updated.status === 'parsing') {
            setStatus('parsing')
            setProgress(t('upload_progParsing'))
          } else if (updated.status === 'done') {
            clearTimeout(watchdogRef.current)
            setStatus('done')
            setProgress(t('upload_progLogged'))
            if (channelRef.current) supabase.removeChannel(channelRef.current)
            if (onSuccess) onSuccess(updated.parsed_session_id)
          } else if (updated.status === 'error') {
            clearTimeout(watchdogRef.current)
            setStatus('error')
            setErrMsg(updated.error || t('upload_errParseError'))
            if (channelRef.current) supabase.removeChannel(channelRef.current)
          }
        })
        .subscribe()
      channelRef.current = ch

      setStatus('parsing')
      setProgress(t('upload_progInvoking'))

      // Watchdog: if the edge fn returns 200 but dies before writing a terminal
      // status (done/error) to the job row, no realtime UPDATE arrives and the UI
      // is stuck on "Parsing…" forever. After PARSE_TIMEOUT_MS, flip to error so
      // the "Try again" button appears.
      clearTimeout(watchdogRef.current)
      watchdogRef.current = setTimeout(() => {
        setStatus(prev => {
          if (prev !== 'parsing') return prev
          setErrMsg(t('upload_errTimedOut'))
          if (channelRef.current) supabase.removeChannel(channelRef.current)
          return 'error'
        })
      }, PARSE_TIMEOUT_MS)

      // 4. Invoke parse-activity edge function
      const { error: fnErr } = await supabase.functions.invoke('parse-activity', {
        body: { jobId, fileType: ext },
      })

      if (fnErr) {
        // Edge fn returned an error — job row will already be updated to 'error'
        clearTimeout(watchdogRef.current)
        logger.warn('parse-activity:', fnErr.message)
        setStatus('error')
        setErrMsg(t('upload_errParseFailed').replace('{msg}', fnErr.message))
        if (channelRef.current) supabase.removeChannel(channelRef.current)
      }
    } catch (e) {
      clearTimeout(watchdogRef.current)
      logger.error('UploadActivity:', e.message)
      setStatus('error')
      setErrMsg(e.message)
    } finally {
      // Release the guard once the synchronous upload+invoke completes; by now
      // status is 'parsing'/'error'/'done' so the dropzone's disabled prop holds.
      inFlightRef.current = false
    }
  }, [authUser, tierBlocked, onSuccess, t])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop:   accepted => accepted[0] && processFile(accepted[0]),
    accept:   ACCEPT_EXT,
    maxSize:  MAX_BYTES,
    maxFiles: 1,
    disabled: status !== 'idle' && status !== 'error' && status !== 'done',
    onDropRejected: rejected => {
      const reason = rejected[0]?.errors?.[0]?.code
      setErrMsg(reason === 'file-too-large' ? t('upload_errTooLargeShort') : t('upload_errUnsupported'))
    },
  })

  return (
    <div style={{ ...S.card, maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...S.cardTitle }}>
        <span>{t('upload_title')}</span>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '18px', lineHeight: 1, padding: 0 }}
            aria-label={t('upload_closeAria')}>×</button>
        )}
      </div>

      {tierBlocked ? (
        <div style={{ ...S.mono, fontSize: '12px', color: '#ff6600', lineHeight: 1.6, padding: '8px 0' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{t('upload_limitReached')}</div>
          <div>{errMsg}</div>
          <div style={{ marginTop: '8px', color: 'var(--muted)', fontSize: '11px' }}>
            {t('upload_freePlan').replace('{n}', String(FREE_UPLOAD_LIMIT))}
          </div>
        </div>
      ) : (
        <>
          <div
            {...getRootProps()}
            aria-label={t('upload_dropzoneAria')}
            style={{
              border: `2px dashed ${isDragActive ? '#ff6600' : 'var(--border)'}`,
              borderRadius: '8px',
              padding: '28px 16px',
              textAlign: 'center',
              cursor: status === 'idle' || status === 'error' ? 'pointer' : 'default',
              background: isDragActive ? '#ff660011' : 'var(--surface)',
              transition: 'border-color 200ms, background 200ms',
            }}
          >
            <input {...getInputProps()} aria-label={t('upload_inputAria')} />
            <div style={{ ...S.mono, fontSize: '28px', marginBottom: '8px', color: 'var(--muted)' }}>↑</div>
            <div style={{ ...S.mono, fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
              {isDragActive ? t('upload_dropHere') : t('upload_dropPrompt')}
            </div>
            <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)' }}>
              {t('upload_browseHint')}
            </div>
          </div>

          {(status !== 'idle') && (
            <div style={{ marginTop: '12px', ...S.mono, fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  display: 'inline-block', width: '8px', height: '8px',
                  borderRadius: '50%', background: STATUS_COLOR[status], flexShrink: 0,
                }} />
                <span style={{ color: STATUS_COLOR[status], fontWeight: 600 }}>
                  {STATUS_LABEL_KEY[status] ? t(STATUS_LABEL_KEY[status]) : ''}
                </span>
              </div>
              {progress && status !== 'done' && status !== 'error' && (
                <div style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '10px', paddingLeft: '16px' }}>
                  {progress}
                </div>
              )}
            </div>
          )}

          {errMsg && (
            <div style={{ marginTop: '8px', ...S.mono, fontSize: '11px', color: '#e03030' }}>
              {errMsg}
            </div>
          )}

          {status === 'done' && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setStatus('idle'); setErrMsg(''); setProgress('') }}
                style={{ ...S.btnSec, fontSize: '11px', padding: '6px 12px' }}
              >
                {t('upload_uploadAnother')}
              </button>
              {onClose && (
                <button onClick={onClose} style={{ ...S.btn, fontSize: '11px', padding: '6px 12px' }}>
                  {t('upload_viewLog')}
                </button>
              )}
            </div>
          )}

          {status === 'error' && (
            <button
              onClick={() => { setStatus('idle'); setErrMsg(''); setProgress('') }}
              style={{ ...S.btnSec, fontSize: '11px', padding: '6px 12px', marginTop: '8px' }}
            >
              {t('upload_tryAgain')}
            </button>
          )}
        </>
      )}
    </div>
  )
}
