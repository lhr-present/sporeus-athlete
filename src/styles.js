// ─── Animation + theme CSS ────────────────────────────────────────────────────
export const ANIM_CSS = `
  @keyframes fadeIn  { from{opacity:0}to{opacity:1} }
  @keyframes slideUp { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }
  .sp-fade { animation:fadeIn 200ms ease-out both }
  .sp-card { animation:slideUp 300ms ease-out both }
  :root {
    --bg:#ffffff; --text:#1a1a1a; --card:#ffffff; --card-bg:#f8f8f8;
    --border:#e0e0e0; --muted:#888; --sub:#555; --surface:#fafafa;
    --input-bg:#ffffff; --input-border:#ccc;
  }
  :root[data-theme="dark"] {
    --bg:#0a0a0a; --text:#e5e5e5; --card:#1a1a1a; --card-bg:#111111;
    --border:#333333; --muted:#888; --sub:#aaa; --surface:#111111;
    --input-bg:#1a1a1a; --input-border:#444;
  }
`

// ─── Styles ────────────────────────────────────────────────────────────────────
export const S = {
  app: { fontFamily:"'IBM Plex Sans',system-ui,sans-serif", backgroundColor:'var(--bg)', color:'var(--text)', minHeight:'100vh', maxWidth:'900px', margin:'0 auto', paddingTop:'3px' },
  topBar: { height:'3px', background:'#ff6600', position:'fixed', top:0, left:0, right:0, zIndex:9999 },
  header: { background:'#0a0a0a', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #ff6600' },
  headerTitle: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', fontWeight:600, letterSpacing:'0.12em', color:'#ff6600' },
  headerSub: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#888', letterSpacing:'0.06em' },
  navWrap: { background:'#0a0a0a', overflowX:'auto', WebkitOverflowScrolling:'touch', scrollbarWidth:'none', borderBottom:'2px solid #222' },
  nav: { display:'flex', minWidth:'max-content' },
  navBtn: a => ({ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', fontWeight:600, letterSpacing:'0.08em', padding:'10px 13px', border:'none', cursor:'pointer', background:a?'#ff6600':'transparent', color:a?'#fff':'#888', borderBottom:a?'2px solid #ff6600':'2px solid transparent', transition:'all 0.15s', whiteSpace:'nowrap' }),
  content: { padding:'20px' },
  card: { background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'6px', padding:'16px', marginBottom:'16px' },
  cardTitle: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'12px', borderBottom:'1px solid var(--border)', paddingBottom:'8px' },
  row: { display:'flex', gap:'12px', flexWrap:'wrap' },
  label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'var(--muted)', marginBottom:'4px', display:'block' },
  input: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'14px', padding:'8px 12px', border:'1px solid var(--input-border)', borderRadius:'4px', width:'100%', boxSizing:'border-box', background:'var(--input-bg)', color:'var(--text)' },
  select: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', padding:'8px 12px', border:'1px solid var(--input-border)', borderRadius:'4px', width:'100%', boxSizing:'border-box', background:'var(--input-bg)', color:'var(--text)', cursor:'pointer' },
  btn: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, letterSpacing:'0.06em', padding:'10px 18px', background:'#ff6600', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer' },
  btnSec: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, padding:'8px 14px', background:'transparent', color:'#ff6600', border:'1px solid #ff6600', borderRadius:'4px', cursor:'pointer' },
  stat: { flex:'1 1 110px', background:'#0a0a0a', borderRadius:'6px', padding:'14px', textAlign:'center' },
  statVal: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'22px', fontWeight:600, color:'#ff6600', display:'block' },
  statLbl: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#888', letterSpacing:'0.1em', textTransform:'uppercase' },
  tag: c => ({ display:'inline-block', fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', fontWeight:600, padding:'2px 8px', borderRadius:'3px', background:c+'22', color:c, border:`1px solid ${c}44` }),
  mono: { fontFamily:"'IBM Plex Mono',monospace" },
  footer: { textAlign:'center', padding:'20px', borderTop:'1px solid var(--border)', fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--muted)', letterSpacing:'0.06em' },
}
