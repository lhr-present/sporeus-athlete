import { COLOR, FONT, RADIUS, TRANSITION } from './styles/tokens.js'

// ─── Animation + theme CSS ────────────────────────────────────────────────────
export const ANIM_CSS = `
  @keyframes fadeIn  { from{opacity:0}to{opacity:1} }
  @keyframes slideUp { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }
  .sp-fade { animation:fadeIn 200ms ease-out both }
  .sp-card { animation:slideUp 300ms ease-out both }
  @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 ${COLOR.orange}66} 70%{box-shadow:0 0 0 6px ${COLOR.orange}00} }
  .sp-tab-pulse { animation:pulse 1.6s ease-out infinite }
  @keyframes sp-dot { 0%,80%,100%{opacity:0.2;transform:scale(0.8)} 40%{opacity:1;transform:scale(1.2)} }
  @media (prefers-reduced-motion: reduce) {
    .sp-fade, .sp-card { animation-duration:0.01ms !important }
    .sp-tab-pulse { animation:none !important }
    * { transition-duration:0.01ms !important }
  }
  :root {
    --bg:#ffffff; --text:#1a1a1a; --card:#ffffff; --card-bg:#f8f8f8;
    --border:#e0e0e0; --muted:#888; --sub:#555; --surface:#fafafa;
    --input-bg:#ffffff; --input-border:#ccc;
    --safe-top:env(safe-area-inset-top,0px); --safe-bottom:env(safe-area-inset-bottom,0px);
    --safe-left:env(safe-area-inset-left,0px); --safe-right:env(safe-area-inset-right,0px);
  }
  :root[data-theme="dark"] {
    --bg:#0a0a0a; --text:#e5e5e5; --card:#1a1a1a; --card-bg:#111111;
    --border:#333333; --muted:#888; --sub:#aaa; --surface:#111111;
    --input-bg:#1a1a1a; --input-border:#444;
  }
  /* Mobile-first tap targets */
  button, [role="button"], input[type="submit"], input[type="button"] {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  /* Focus ring — visible for keyboard nav */
  :focus-visible { outline: 2px solid #ff6600; outline-offset: 2px; border-radius: 2px; }
  /* Mobile layout overrides */
  @media (max-width: 640px) {
    .sp-content { padding: 12px !important; }
    .sp-nav-btn { padding: 10px 10px !important; font-size: 9px !important; }
    .sp-header { padding: 8px 12px !important; padding-top: max(8px, var(--safe-top)) !important; }
  }
`

// ─── Styles ────────────────────────────────────────────────────────────────────
export const S = {
  // ── App shell ───────────────────────────────────────────────────────────────
  app:        { fontFamily:FONT.sans, backgroundColor:'var(--bg)', color:'var(--text)', minHeight:'100vh', maxWidth:'900px', margin:'0 auto', paddingTop:'3px' },
  topBar:     { height:'3px', background:COLOR.orange, position:'fixed', top:0, left:0, right:0, zIndex:9999 },
  header:     { background:COLOR.black, padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${COLOR.orange}` },
  headerTitle:{ fontFamily:FONT.mono, fontSize:FONT.size.lg, fontWeight:600, letterSpacing:FONT.track.wider, color:COLOR.orange },
  headerSub:  { fontFamily:FONT.mono, fontSize:FONT.size.sm, color:COLOR.grey, letterSpacing:FONT.track.tight },
  navWrap:    { background:COLOR.black, overflowX:'auto', WebkitOverflowScrolling:'touch', scrollbarWidth:'none', borderBottom:`2px solid ${COLOR.dark22}` },
  nav:        { display:'flex', minWidth:'max-content' },
  navBtn:     a => ({ fontFamily:FONT.mono, fontSize:FONT.size.sm, fontWeight:600, letterSpacing:FONT.track.normal, padding:'10px 13px', border:'none', cursor:'pointer', background:a?COLOR.orange:'transparent', color:a?COLOR.white:COLOR.grey, borderBottom:a?`2px solid ${COLOR.orange}`:'2px solid transparent', transition:TRANSITION.fast, whiteSpace:'nowrap' }),
  content:    { padding:'20px' },
  // ── Cards & layout ──────────────────────────────────────────────────────────
  card:       { background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:RADIUS.xl, padding:'16px', marginBottom:'16px' },
  cardTitle:  { fontFamily:FONT.mono, fontSize:FONT.size.md, fontWeight:600, letterSpacing:FONT.track.wide, textTransform:'uppercase', color:'var(--muted)', marginBottom:'12px', borderBottom:'1px solid var(--border)', paddingBottom:'8px' },
  row:        { display:'flex', gap:'12px', flexWrap:'wrap' },
  // ── Form controls ────────────────────────────────────────────────────────────
  label:      { fontFamily:FONT.mono, fontSize:FONT.size.md, color:'var(--muted)', marginBottom:'4px', display:'block' },
  input:      { fontFamily:FONT.mono, fontSize:FONT.size.xl, padding:'8px 12px', border:'1px solid var(--input-border)', borderRadius:RADIUS.lg, width:'100%', boxSizing:'border-box', background:'var(--input-bg)', color:'var(--text)' },
  select:     { fontFamily:FONT.mono, fontSize:FONT.size.lg, padding:'8px 12px', border:'1px solid var(--input-border)', borderRadius:RADIUS.lg, width:'100%', boxSizing:'border-box', background:'var(--input-bg)', color:'var(--text)', cursor:'pointer' },
  // ── Buttons ──────────────────────────────────────────────────────────────────
  btn:        { fontFamily:FONT.mono, fontSize:FONT.size.base, fontWeight:600, letterSpacing:FONT.track.tight, padding:'10px 18px', background:COLOR.orange, color:COLOR.white, border:'none', borderRadius:RADIUS.lg, cursor:'pointer', touchAction:'manipulation', minHeight:'44px' },
  btnSec:     { fontFamily:FONT.mono, fontSize:FONT.size.base, fontWeight:600, padding:'8px 14px', background:'transparent', color:COLOR.orange, border:`1px solid ${COLOR.orange}`, borderRadius:RADIUS.lg, cursor:'pointer', touchAction:'manipulation', minHeight:'44px' },
  // ── Stats ────────────────────────────────────────────────────────────────────
  stat:       { flex:'1 1 110px', background:COLOR.black, borderRadius:RADIUS.xl, padding:'14px', textAlign:'center' },
  statVal:    { fontFamily:FONT.mono, fontSize:FONT.size.stat, fontWeight:600, color:COLOR.orange, display:'block' },
  statLbl:    { fontFamily:FONT.mono, fontSize:FONT.size.xs, color:COLOR.grey, letterSpacing:FONT.track.wide, textTransform:'uppercase' },
  // ── Misc ─────────────────────────────────────────────────────────────────────
  tag:        c => ({ display:'inline-block', fontFamily:FONT.mono, fontSize:FONT.size.sm, fontWeight:600, padding:'2px 8px', borderRadius:RADIUS.md, background:c+'22', color:c, border:`1px solid ${c}44` }),
  mono:       { fontFamily:FONT.mono },
  footer:     { textAlign:'center', padding:'20px', borderTop:'1px solid var(--border)', fontFamily:FONT.mono, fontSize:FONT.size.sm, color:'var(--muted)', letterSpacing:FONT.track.tight },

  // ── Utility tokens (design system layer) ─────────────────────────────────────
  // Use these to replace repeated inline style objects in components.
  ghostBtn:     { background:'none', border:'none', cursor:'pointer', fontFamily:FONT.mono, fontSize:FONT.size.xs, color:COLOR.dim },
  dimText:      { fontFamily:FONT.mono, fontSize:FONT.size.xs, color:COLOR.dark4 },
  sectionLabel: { fontFamily:FONT.mono, fontSize:FONT.size.xs, letterSpacing:FONT.track.wide, color:COLOR.dim },
  smBtn:        { fontFamily:FONT.mono, fontSize:FONT.size.sm, fontWeight:700, letterSpacing:FONT.track.wide, padding:'6px 16px', background:COLOR.orange, border:'none', borderRadius:RADIUS.md, color:COLOR.white, cursor:'pointer' },
  badgeOutline: c => ({ fontFamily:FONT.mono, fontSize:FONT.size.xxs, padding:'1px 5px', borderRadius:RADIUS.sm, border:`1px solid ${c}55`, color:c }),
}
