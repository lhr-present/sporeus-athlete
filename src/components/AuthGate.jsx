// ─── AuthGate.jsx — Login screen (Google OAuth + email/password) ──────────────
import { useState, useCallback, useContext } from 'react'
import { supabase } from '../lib/supabase.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { version as APP_VERSION } from '../../package.json'

const MONO = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const _BLUE  = '#0064ff' // reserved for future link colour
const RED    = '#e03030'
const GREEN  = '#5bc25b'

function _S(base, over) { return over ? { ...base, ...over } : base }

const card = {
  background: '#111',
  border: '1px solid #2a2a2a',
  borderRadius: '8px',
  padding: '40px 36px',
  width: '100%',
  maxWidth: '400px',
  boxSizing: 'border-box',
}
const label = {
  fontFamily: MONO,
  fontSize: '10px',
  color: '#666',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: '6px',
  display: 'block',
}
const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: '4px',
  color: '#eee',
  fontFamily: MONO,
  fontSize: '13px',
  padding: '10px 12px',
  outline: 'none',
  marginBottom: '14px',
}
const btnBase = {
  width: '100%',
  padding: '12px',
  borderRadius: '5px',
  border: 'none',
  fontFamily: MONO,
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'opacity 0.15s',
}

// Google "G" icon SVG
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" style={{ display:'block', flexShrink:0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  )
}

export default function AuthGate({ lang }) {
  const ctx = useContext(LangCtx)
  const _t = ctx?.t || (k => k) // reserved — auth strings not yet translated

  const [mode, setMode]     = useState('login')   // 'login' | 'signup' | 'magic'
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [busy, setBusy]     = useState(false)
  const [msg, setMsg]       = useState(null)       // { type: 'error'|'success', text }
  const [awaitingConfirm, setAwaitingConfirm] = useState(false) // signup email sent → show resend affordance
  const [resendBusy, setResendBusy] = useState(false)

  const clearMsg = () => setMsg(null)

  const handleGoogle = useCallback(async () => {
    if (!supabase) { setMsg({ type: 'error', text: 'Supabase not configured' }); return }
    setBusy(true); clearMsg()
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + import.meta.env.BASE_URL,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (error) { setMsg({ type: 'error', text: error.message }); setBusy(false) }
    } catch (e) {
      setMsg({ type: 'error', text: e.message }); setBusy(false)
    }
  }, [])

  // v9.493 (publish-readiness F2): there was NO password reset path anywhere.
  const handleForgot = useCallback(async () => {
    if (!supabase || !email) {
      setMsg({ type: 'error', text: lang === 'tr' ? 'Önce e-posta adresini gir.' : 'Enter your email first.' })
      return
    }
    setBusy(true); clearMsg()
    try {
      const redirectTo = window.location.origin + import.meta.env.BASE_URL
      await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      // Success-shaped regardless of registration (enumeration guard) — phrase accordingly.
      setMsg({ type: 'success', text: lang === 'tr'
        ? 'Bu adres kayıtlıysa sıfırlama bağlantısı gönderildi — gelen kutunu kontrol et.'
        : 'If this address is registered, a reset link was sent — check your inbox.' })
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
    setBusy(false)
  }, [email, lang])

  const handleEmail = useCallback(async (e) => {
    e.preventDefault()
    if (!supabase || !email) return
    setBusy(true); clearMsg()
    try {
      let error
      const redirectTo = window.location.origin + import.meta.env.BASE_URL
      if (mode === 'login') {
        ({ error } = await supabase.auth.signInWithPassword({ email, password: pass }))
      } else if (mode === 'signup') {
        ({ error } = await supabase.auth.signUp({ email, password: pass, options: { emailRedirectTo: redirectTo } }))
        if (!error) {
          setMsg({ type: 'success', text: lang === 'tr' ? 'Kayıt e-postası gönderildi — gelen kutunu kontrol et.' : 'Confirmation email sent — check your inbox.' })
          setAwaitingConfirm(true)
          setBusy(false); return
        }
      } else {
        ({ error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } }))
        if (!error) {
          setMsg({ type: 'success', text: lang === 'tr' ? 'Sihirli bağlantı gönderildi — gelen kutunu kontrol et.' : 'Magic link sent — check your inbox.' })
          setBusy(false); return
        }
      }
      if (error) {
        // Leaked/weak-password rejection (Supabase HIBP check, error.code 'weak_password').
        // Surface a bilingual message instead of the raw English string.
        const reasons = error.weakPassword?.reasons || []
        const text = error.code === 'weak_password'
          ? (reasons.includes('pwned')
              ? (lang === 'tr'
                  ? 'Bu şifre bilinen bir veri sızıntısında bulundu. Lütfen farklı, benzersiz bir şifre seç.'
                  : 'This password has appeared in a known data breach. Please choose a different, unique password.')
              : (lang === 'tr'
                  ? 'Şifre çok zayıf. Daha uzun veya daha karmaşık bir şifre dene.'
                  : 'Password is too weak. Try a longer or more complex one.'))
          : error.message
        setMsg({ type: 'error', text })
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
    setBusy(false)
  }, [email, pass, mode, lang])

  // Resend the signup confirmation email — recovers a user whose verification mail was
  // lost/spam-filtered. Note: Supabase returns success-shaped responses for already-registered
  // emails (enumeration guard), so the hint below points such users to Sign In / Magic.
  const handleResend = useCallback(async () => {
    if (!supabase || !email || resendBusy) return
    setResendBusy(true)
    try {
      const redirectTo = window.location.origin + import.meta.env.BASE_URL
      const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo } })
      setMsg(error
        ? { type: 'error', text: error.message }
        : { type: 'success', text: lang === 'tr' ? 'Doğrulama e-postası yeniden gönderildi.' : 'Verification email resent.' })
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
    setResendBusy(false)
  }, [email, resendBusy, lang])

  const isTR = lang === 'tr'

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: MONO,
    }}>
      {/* Terminal top-bar */}
      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: RED }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e0a030' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: GREEN }} />
        <div style={{ flex: 1, height: 1, background: '#222', marginLeft: 8 }} />
        <span style={{ fontSize: 9, color: '#444', letterSpacing: '0.1em' }}>SPOREUS ATHLETE CONSOLE</span>
      </div>

      <div style={card}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: ORANGE, letterSpacing: '0.08em' }}>
            ◈ SPOREUS
          </div>
          <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.15em', marginTop: '4px' }}>
            {isTR ? 'SPORCU PERFORMANS KONSOLU' : 'ATHLETE PERFORMANCE CONSOLE'}
          </div>
          <div style={{ width: '100%', height: 1, background: '#222', marginTop: '16px' }} />
        </div>

        {/* Google sign-in */}
        <button
          onClick={handleGoogle}
          disabled={busy}
          style={{
            ...btnBase,
            background: '#fff',
            color: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '16px',
            opacity: busy ? 0.5 : 1,
          }}
        >
          <GoogleIcon />
          <span>{isTR ? 'Google ile devam et' : 'Continue with Google'}</span>
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ flex: 1, height: 1, background: '#222' }} />
          <span style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: '#222' }} />
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
          {[
            ['login',  isTR ? 'GİRİŞ'   : 'SIGN IN'],
            ['signup', isTR ? 'KAYIT'    : 'SIGN UP'],
            ['magic',  isTR ? 'MAGİC'    : 'MAGIC'],
          ].map(([m, label2]) => (
            <button key={m} onClick={() => { setMode(m); clearMsg(); setAwaitingConfirm(false) }} style={{
              flex: 1, padding: '6px 4px', border: 'none', borderRadius: '3px', cursor: 'pointer',
              fontFamily: MONO, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
              background: mode === m ? ORANGE : '#1a1a1a',
              color:      mode === m ? '#fff'  : '#555',
            }}>
              {label2}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleEmail}>
          <label style={label}>{isTR ? 'E-POSTA' : 'EMAIL'}</label>
          <input
            type="email"
            name="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={isTR ? 'siz@ornek.com' : 'you@example.com'}
            required
            style={inputStyle}
          />

          {mode !== 'magic' && (
            <>
              <label style={label}>{isTR ? 'ŞİFRE' : 'PASSWORD'}</label>
              <input
                type="password"
                name="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder={mode === 'signup' ? (isTR ? 'Min. 8 karakter' : 'Min. 8 characters') : '••••••••'}
                required
                minLength={8}
                style={{ ...inputStyle, marginBottom: mode === 'login' ? '6px' : '20px' }}
              />
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={busy}
                  style={{ background: 'none', border: 'none', padding: 0, marginBottom: '14px', cursor: 'pointer', fontSize: '10px', color: '#888', textDecoration: 'underline', textAlign: 'left' }}
                >
                  {isTR ? 'Şifreni mi unuttun?' : 'Forgot password?'}
                </button>
              )}
            </>
          )}

          {mode === 'magic' && (
            <p style={{ fontSize: '10px', color: '#555', lineHeight: 1.6, marginBottom: '20px' }}>
              {isTR ? 'Bağlantı e-postana gönderilecek — şifre gerekmez.' : 'A link will be emailed to you — no password needed.'}
            </p>
          )}

          {msg && (
            <div style={{
              fontSize: '11px', fontFamily: MONO, padding: '8px 12px', borderRadius: '4px', marginBottom: '14px',
              background: msg.type === 'error' ? 'rgba(224,48,48,0.12)' : 'rgba(91,194,91,0.12)',
              border: `1px solid ${msg.type === 'error' ? RED : GREEN}`,
              color: msg.type === 'error' ? RED : GREEN,
              lineHeight: 1.5,
            }}>
              {msg.text}
            </div>
          )}

          {/* Resend-verification recovery for stranded users (v9.449) */}
          {awaitingConfirm && (
            <div style={{ fontSize: '10px', fontFamily: MONO, color: '#888', marginBottom: '14px', lineHeight: 1.6 }}>
              <button type="button" onClick={handleResend} disabled={resendBusy}
                style={{ background: 'none', border: 'none', padding: 0, color: resendBusy ? '#555' : '#0064ff', cursor: resendBusy ? 'default' : 'pointer', fontFamily: MONO, fontSize: '10px', textDecoration: 'underline' }}>
                {resendBusy ? '…' : (isTR ? 'Doğrulama e-postasını yeniden gönder' : 'Resend confirmation email')}
              </button>
              <div style={{ marginTop: '6px' }}>
                {isTR
                  ? 'E-posta gelmediyse spam klasörüne bak. Bu adres zaten kayıtlıysa e-posta gelmez — GİRİŞ veya MAGİC ile dene.'
                  : "No email? Check spam. If this address is already registered you won't get one — try SIGN IN or MAGIC instead."}
              </div>
            </div>
          )}

          <button type="submit" disabled={busy} style={{
            ...btnBase,
            background: ORANGE,
            color: '#fff',
            opacity: busy ? 0.5 : 1,
          }}>
            {busy ? '...' : mode === 'login'
              ? (isTR ? 'GİRİŞ YAP' : 'SIGN IN')
              : mode === 'signup'
              ? (isTR ? 'HESAP OLUŞTUR' : 'CREATE ACCOUNT')
              : (isTR ? 'BAĞLANTI GÖNDER' : 'SEND LINK')}
          </button>
        </form>

        {/* Guest mode */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', margin:'20px 0 0' }}>
          <div style={{ flex:1, height:1, background:'#1e1e1e' }}/>
          <span style={{ fontSize:'9px', color:'#333', letterSpacing:'0.1em' }}>{isTR ? 'VEYA' : 'OR'}</span>
          <div style={{ flex:1, height:1, background:'#1e1e1e' }}/>
        </div>
        <button
          onClick={() => { localStorage.setItem('sporeus-guest-mode','1'); window.location.reload() }}
          style={{ ...btnBase, background:'transparent', border:'1px solid #2a2a2a', color:'#555', marginTop:'12px' }}>
          {isTR ? '→ Hesapsız dene  (cihaza kaydeder)' : '→ Try without account  (saves to this device)'}
        </button>

        {/* Footer */}
        <p style={{ fontSize: '9px', color: '#333', textAlign: 'center', marginTop: '16px', lineHeight: 1.8 }}>
          {isTR ? (
            <>
              Devam ederek{' '}
              <a href="?privacy=1" target="_blank" rel="noopener noreferrer" style={{ color:'#555', textDecoration:'underline' }}>
                Sporeus gizlilik politikasını
              </a>{' '}
              kabul etmiş olursunuz. Verileriniz yalnızca sizin hesabınızda saklanır.
            </>
          ) : (
            <>
              By continuing you accept the{' '}
              <a href="?privacy=1" target="_blank" rel="noopener noreferrer" style={{ color:'#555', textDecoration:'underline' }}>
                Sporeus privacy policy
              </a>
              . Your data is stored only in your account.
            </>
          )}
        </p>
      </div>

      {/* Version tag */}
      <div style={{ marginTop: '20px', fontSize: '9px', color: '#2a2a2a', letterSpacing: '0.1em' }}>
        SPOREUS v{APP_VERSION} · SPOREUS.COM
      </div>
    </div>
  )
}
