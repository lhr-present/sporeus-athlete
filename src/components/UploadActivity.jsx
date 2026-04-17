// ─── UploadActivity.jsx — Server-side FIT/GPX upload + parse ─────────────────
// Drag-and-drop FIT/GPX upload → Supabase Storage → parse-activity edge function
// Shows progress stages: idle → uploading → pending → parsing → done | error
// Free tier: 5 uploads/month enforced client-side (server also enforces).

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { canUploadFile, FREE_UPLOAD_LIMIT, getTierSync, getUpgradePrompt } from '../lib/subscription.js'
import { logger } from '../lib/logger.js'
import { S } from '../styles.js'

const MAX_BYTES  = 26_214_400          // 25 MB (must match edge fn + bucket)
const BUCKET     = 'activity-uploads'
const ACCEPT_EXT = { 'application/octet-stream': ['.fit'], 'text/xml': ['.gpx'], 'application/xml': ['.gpx'] }

const STATUS_LABEL = {
  idle:      '',
  uploading: 'Uploading to storage…',
  pending:   'Queued for parse…',
  parsing:   'Parsing activity…',
  done:      'Done — session logged!',
  error:     'Parse failed.',
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
  const [status,   setStatus]  = useState('idle')
  const [errMsg,   setErrMsg]  = useState('')
  const [progress, setProgress] = useState('')
  const [tierBlocked, setTierBlocked] = useState(false)
  const channelRef = useRef(null)

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

  // Cleanup realtime on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  const processFile = useCallback(async (file) => {
    if (!authUser || !isSupabaseReady()) {
      setErrMsg('Sign in to upload activities.'); return
    }
    if (file.size > MAX_BYTES) {
      setErrMsg(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 25 MB.`); return
    }
    if (tierBlocked) return

    const ext = file.name.split('.').pop().toLowerCase()
    if (!['fit', 'gpx'].includes(ext)) {
      setErrMsg('Only .fit and .gpx files are supported.'); return
    }

    setErrMsg('')
    setStatus('uploading')
    setProgress('Uploading…')

    try {
      // 1. Upload raw file to Storage
      const ts   = Date.now()
      const path = `${authUser.id}/${ts}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
      if (upErr) throw new Error('Upload failed: ' + upErr.message)

      setStatus('pending')
      setProgress('Creating job…')

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
      if (jobErr || !jobRow) throw new Error('Job creation failed: ' + (jobErr?.message || 'unknown'))

      const jobId = jobRow.id

      // 3. Subscribe to realtime updates on this job row
      const ch = supabase
        .channel(`upload-job-${jobId}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'activity_upload_jobs',
          filter: `id=eq.${jobId}`,
        }, ({ new: updated }) => {
          if (updated.status === 'parsing') {
            setStatus('parsing')
            setProgress('Edge function parsing…')
          } else if (updated.status === 'done') {
            setStatus('done')
            setProgress('Session logged successfully!')
            if (channelRef.current) supabase.removeChannel(channelRef.current)
            if (onSuccess) onSuccess(updated.parsed_session_id)
          } else if (updated.status === 'error') {
            setStatus('error')
            setErrMsg(updated.error || 'Parse error')
            if (channelRef.current) supabase.removeChannel(channelRef.current)
          }
        })
        .subscribe()
      channelRef.current = ch

      setStatus('parsing')
      setProgress('Invoking parse-activity…')

      // 4. Invoke parse-activity edge function
      const { error: fnErr } = await supabase.functions.invoke('parse-activity', {
        body: { jobId, fileType: ext },
      })

      if (fnErr) {
        // Edge fn returned an error — job row will already be updated to 'error'
        logger.warn('parse-activity:', fnErr.message)
        setStatus('error')
        setErrMsg('Parse failed: ' + fnErr.message)
        if (channelRef.current) supabase.removeChannel(channelRef.current)
      }
    } catch (e) {
      logger.error('UploadActivity:', e.message)
      setStatus('error')
      setErrMsg(e.message)
    }
  }, [authUser, tierBlocked, onSuccess])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop:   accepted => accepted[0] && processFile(accepted[0]),
    accept:   ACCEPT_EXT,
    maxSize:  MAX_BYTES,
    maxFiles: 1,
    disabled: status !== 'idle' && status !== 'error' && status !== 'done',
    onDropRejected: rejected => {
      const reason = rejected[0]?.errors?.[0]?.code
      setErrMsg(reason === 'file-too-large' ? 'File too large (max 25 MB).' : 'Only .fit and .gpx files are supported.')
    },
  })

  return (
    <div style={{ ...S.card, maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...S.cardTitle }}>
        <span>↑ UPLOAD ACTIVITY</span>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '18px', lineHeight: 1, padding: 0 }}
            aria-label="Close upload panel">×</button>
        )}
      </div>

      {tierBlocked ? (
        <div style={{ ...S.mono, fontSize: '12px', color: '#ff6600', lineHeight: 1.6, padding: '8px 0' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Upload limit reached</div>
          <div>{errMsg}</div>
          <div style={{ marginTop: '8px', color: 'var(--muted)', fontSize: '11px' }}>
            Free plan: {FREE_UPLOAD_LIMIT} uploads / month
          </div>
        </div>
      ) : (
        <>
          <div
            {...getRootProps()}
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
            <input {...getInputProps()} />
            <div style={{ ...S.mono, fontSize: '28px', marginBottom: '8px', color: 'var(--muted)' }}>↑</div>
            <div style={{ ...S.mono, fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
              {isDragActive ? 'Drop here' : 'Drop .fit or .gpx file'}
            </div>
            <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)' }}>
              or click to browse · max 25 MB
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
                  {STATUS_LABEL[status]}
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
                Upload another
              </button>
              {onClose && (
                <button onClick={onClose} style={{ ...S.btn, fontSize: '11px', padding: '6px 12px' }}>
                  View log
                </button>
              )}
            </div>
          )}

          {status === 'error' && (
            <button
              onClick={() => { setStatus('idle'); setErrMsg(''); setProgress('') }}
              style={{ ...S.btnSec, fontSize: '11px', padding: '6px 12px', marginTop: '8px' }}
            >
              Try again
            </button>
          )}
        </>
      )}
    </div>
  )
}
