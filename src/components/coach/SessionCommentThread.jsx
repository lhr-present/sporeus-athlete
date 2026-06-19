// src/components/coach/SessionCommentThread.jsx
// E11 — Threaded comment panel for a single training session.
// Used by coach (in ExpandedRow / session detail) and athlete (session detail view).
// Features: post, reply, edit, soft-delete, optimistic updates, typing indicators,
//           offline queue indicator, bilingual EN/TR.
//
// Props:
//   sessionId     — training_log.id
//   currentUserId — auth.uid()
//   authorNames   — { [userId]: string } — display names for badge
//   maxHeight     — optional scroll container height (default '320px')

import { useState, useContext, useRef } from 'react'
import { LangCtx }         from '../../contexts/LangCtx.jsx'
import { S }               from '../../styles.js'
import { COLOR, FONT, RADIUS } from '../../styles/tokens.js'
import { useSessionComments } from '../../hooks/useSessionComments.js'

const STATUS_DOT = {
  live:         { color: COLOR.green,  label: '●' },
  connecting:   { color: COLOR.yellow, label: '○' },
  reconnecting: { color: COLOR.yellow, label: '○' },
  disconnected: { color: COLOR.dim,    label: '○' },
}

export default function SessionCommentThread({
  sessionId,
  currentUserId,
  authorNames = {},
  maxHeight = '320px',
}) {
  const { t, lang } = useContext(LangCtx)
  const {
    comments, status, typingUsers, views,
    postComment, editComment, deleteComment,
  } = useSessionComments(sessionId, currentUserId)

  const [body,        setBody]        = useState('')
  const [replyTo,     setReplyTo]     = useState(null)   // { id, authorName }
  const [editingId,   setEditingId]   = useState(null)
  const [editBody,    setEditBody]    = useState('')
  const [offlineNote, setOfflineNote] = useState(false)
  const [actionErr,   setActionErr]   = useState('')
  const textareaRef = useRef(null)

  const dot = STATUS_DOT[status] || STATUS_DOT.disconnected

  // ── Post / reply ─────────────────────────────────────────────────────────────

  async function handlePost(e) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    setBody('')
    const { queued } = await postComment(trimmed, replyTo?.id ?? null)
    setReplyTo(null)
    if (queued) {
      setOfflineNote(true)
      setTimeout(() => setOfflineNote(false), 4000)
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────

  function startEdit(comment) {
    setEditingId(comment.id)
    setEditBody(comment.body)
    setReplyTo(null)
  }

  async function saveEdit(e) {
    e.preventDefault()
    setActionErr('')
    const { error } = await editComment(editingId, editBody.trim())
    if (error) {
      // Genuine server failure (RLS / 4xx-5xx) — keep the editor open so the
      // edit isn't silently lost; the offline-queued path returns no error.
      setActionErr(t('commentActionFailed'))
      return
    }
    setEditingId(null)
    setEditBody('')
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function handleDelete(commentId) {
    setActionErr('')
    const { error } = await deleteComment(commentId)
    if (error) {
      // Keep the comment present on a genuine server failure rather than
      // showing it as deleted when the server rejected the soft-delete.
      setActionErr(t('commentActionFailed'))
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  function authorLabel(userId) {
    return authorNames[userId] || userId?.slice(0, 8) || '?'
  }

  // Group top-level and replies
  const topLevel = comments.filter(c => !c.parent_id)
  const replies  = id => comments.filter(c => c.parent_id === id)

  // "Viewed by" summary — additive, one-shot views from the hook. Shows up to
  // two resolvable names then "+N". Renders nothing when there are no views.
  const viewerList = Array.isArray(views) ? views : []
  const viewerCount = viewerList.length
  const namedViewers = viewerList
    .map(v => authorNames[v?.user_id])
    .filter(Boolean)
  const shownNames = namedViewers.slice(0, 2)
  const extraCount = viewerCount - shownNames.length
  const viewerSummary = shownNames.length
    ? [...shownNames, ...(extraCount > 0 ? [`+${extraCount}`] : [])].join(', ')
    : ''

  return (
    <div style={{ fontFamily: FONT.mono }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: FONT.size.sm, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)' }}>
          {t('commentsTitle')}
        </span>
        <span style={{ fontSize: FONT.size.sm, color: dot.color }}>{dot.label}</span>
        {typingUsers.length > 0 && (
          <span style={{ fontSize: FONT.size.xs, color: COLOR.dim }}>
            {authorLabel(typingUsers[0])} {t('commentTyping')}
          </span>
        )}
      </div>

      {/* Viewed-by summary — only when there are recorded views */}
      {viewerCount > 0 && (
        <div
          data-testid="session-viewed-by"
          style={{ fontSize: FONT.size.xs, color: COLOR.dim, marginBottom: '10px' }}
        >
          {lang === 'tr'
            ? `${viewerCount} kişi görüntüledi${viewerSummary ? ` · ${viewerSummary}` : ''}`
            : `Viewed by ${viewerCount}${viewerSummary ? ` · ${viewerSummary}` : ''}`}
        </div>
      )}

      {/* Comment list */}
      <div style={{ maxHeight, overflowY: 'auto', marginBottom: '12px' }}>
        {comments.length === 0 ? (
          <div style={{ fontSize: FONT.size.md, color: COLOR.dim, padding: '12px 0' }}>
            {t('commentEmpty')}
          </div>
        ) : (
          topLevel.map(c => (
            <div key={c.id}>
              <CommentRow
                comment={c}
                currentUserId={currentUserId}
                authorLabel={authorLabel}
                t={t}
                onReply={() => {
                  setReplyTo({ id: c.id, authorName: authorLabel(c.author_id) })
                  textareaRef.current?.focus()
                }}
                onEdit={() => startEdit(c)}
                onDelete={() => handleDelete(c.id)}
                editingId={editingId}
                editBody={editBody}
                setEditBody={setEditBody}
                saveEdit={saveEdit}
                cancelEdit={() => { setEditingId(null); setEditBody('') }}
                depth={0}
              />
              {/* Replies */}
              {replies(c.id).map(r => (
                <CommentRow
                  key={r.id}
                  comment={r}
                  currentUserId={currentUserId}
                  authorLabel={authorLabel}
                  t={t}
                  onReply={() => {
                    setReplyTo({ id: c.id, authorName: authorLabel(r.author_id) })
                    textareaRef.current?.focus()
                  }}
                  onEdit={() => startEdit(r)}
                  onDelete={() => handleDelete(r.id)}
                  editingId={editingId}
                  editBody={editBody}
                  setEditBody={setEditBody}
                  saveEdit={saveEdit}
                  cancelEdit={() => { setEditingId(null); setEditBody('') }}
                  depth={1}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Compose */}
      <form onSubmit={handlePost} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {replyTo && (
          <div style={{ fontSize: FONT.size.xs, color: COLOR.orange, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>↳ {t('commentReply')} @{replyTo.authorName}</span>
            <button type="button" onClick={() => setReplyTo(null)}
              aria-label={t('commentCancel')}
              style={{ ...S.ghostBtn, color: COLOR.dim }}>✕</button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={t('commentPlaceholder')}
          rows={2}
          maxLength={2000}
          style={{
            ...S.input,
            resize: 'vertical',
            fontSize: FONT.size.base,
            minHeight: '52px',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: FONT.size.xs, color: COLOR.dim }}>
            {body.length > 1800 ? `${body.length}/2000` : ''}
          </span>
          <button type="submit" disabled={!body.trim()} style={{ ...S.smBtn, opacity: body.trim() ? 1 : 0.4 }}>
            {t('commentPost')}
          </button>
        </div>
      </form>

      {/* Offline queue note */}
      {offlineNote && (
        <div style={{
          marginTop: '8px', fontSize: FONT.size.xs, color: COLOR.yellow,
          fontFamily: FONT.mono,
        }}>
          {t('commentOffline')}
        </div>
      )}

      {/* Action error (edit/delete genuine server failure) */}
      {actionErr && (
        <div role="alert" style={{
          marginTop: '8px', fontSize: FONT.size.xs, color: COLOR.red,
          fontFamily: FONT.mono,
        }}>
          {actionErr}
        </div>
      )}
    </div>
  )
}

// ── CommentRow ────────────────────────────────────────────────────────────────

function CommentRow({
  comment, currentUserId, authorLabel, t,
  onReply, onEdit, onDelete,
  editingId, editBody, setEditBody, saveEdit, cancelEdit,
  depth,
}) {
  const isDeleted = !!comment.deleted_at
  const isOwn     = comment.author_id === currentUserId
  const isEditing = editingId === comment.id
  const leftPad   = depth * 20

  return (
    <div style={{
      marginLeft: leftPad,
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
      opacity: comment._optimistic ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: FONT.size.sm, color: COLOR.orange, fontWeight: 700 }}>
          {authorLabel(comment.author_id)}
        </span>
        <span style={{ fontSize: FONT.size.xs, color: COLOR.dim }}>
          {relTime(comment.created_at, t)}
        </span>
        {comment.edited_at && !isDeleted && (
          <span style={{ fontSize: FONT.size.xs, color: COLOR.dim }}>{t('commentEdited')}</span>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <textarea
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            rows={2}
            maxLength={2000}
            autoFocus
            style={{ fontFamily: FONT.mono, fontSize: FONT.size.base, padding: '6px 8px',
              border: '1px solid var(--border)', borderRadius: RADIUS.lg,
              background: 'var(--input-bg)', color: 'var(--text)', resize: 'vertical', width: '100%',
              boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" style={{ fontFamily: FONT.mono, fontSize: FONT.size.xs, color: COLOR.orange, background: 'none', border: `1px solid ${COLOR.orange}44`, borderRadius: RADIUS.sm, padding: '2px 8px', cursor: 'pointer' }}>
              {t('commentSave')}
            </button>
            <button type="button" onClick={cancelEdit} style={{ fontFamily: FONT.mono, fontSize: FONT.size.xs, color: COLOR.dim, background: 'none', border: 'none', cursor: 'pointer' }}>
              {t('commentCancel')}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ fontSize: FONT.size.base, color: isDeleted ? COLOR.dim : 'var(--text)', fontStyle: isDeleted ? 'italic' : 'normal', wordBreak: 'break-word' }}>
          {isDeleted ? t('commentDeleted') : comment.body}
        </div>
      )}

      {/* Actions */}
      {!isDeleted && !isEditing && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
          {depth === 0 && (
            <button onClick={onReply} style={{ ...S.ghostBtn }}>
              {t('commentReply')}
            </button>
          )}
          {isOwn && (
            <>
              <button onClick={onEdit}   style={{ ...S.ghostBtn }}>{t('commentEdit')}</button>
              <button onClick={onDelete} style={{ ...S.ghostBtn, color: COLOR.red }}>{t('commentDelete')}</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function relTime(iso, t) {
  try {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (s < 60)    return t('liveFeed_justNow')
    if (s < 3600)  return t('liveFeed_minAgo').replace('{n}', Math.floor(s / 60))
    if (s < 86400) return t('liveFeed_hourAgo').replace('{n}', Math.floor(s / 3600))
    return t('liveFeed_dayAgo').replace('{n}', Math.floor(s / 86400))
  } catch { return '' }
}
