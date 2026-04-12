import React from 'react'
import { exportAllData } from '../lib/storage.js'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, showDetails: false }
  }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('Sporeus tab error:', error, info) }

  handleExport() {
    try {
      const json = exportAllData()
      const blob = new Blob([json], { type:'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sporeus-error-backup-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      const name  = this.props.name || this.props.tabName || 'component'
      const M = { fontFamily:"'IBM Plex Mono',monospace" }
      const retry = () => this.setState({ hasError: false, error: null, showDetails: false })

      // ── Inline / component-level fallback (compact) ──────────────────────
      if (this.props.inline) {
        return (
          <div style={{ ...M, background:'rgba(224,48,48,0.07)', border:'1px solid #e0303033', borderRadius:'5px', padding:'9px 13px', margin:'8px 0', display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'10px', color:'#e03030', letterSpacing:'0.06em' }}>◈ {name.toUpperCase()} ERROR</span>
            <span style={{ fontSize:'10px', color:'#666' }}>{this.state.error?.message?.slice(0,80) || 'Unexpected error'}</span>
            <button onClick={retry}
              style={{ ...M, fontSize:'9px', padding:'3px 9px', background:'#e03030', color:'#fff', border:'none', cursor:'pointer', borderRadius:'3px', marginLeft:'auto' }}>
              ↻ Retry
            </button>
          </div>
        )
      }

      // ── Tab-level fallback (full) ─────────────────────────────────────────
      const tabName = this.props.tabName || name
      return (
        <div style={{ ...M, background:'#1a0000', border:'1px solid #e03030', borderRadius:'6px', padding:'20px', margin:'20px', color:'#e5e5e5' }}>
          <div style={{ color:'#e03030', fontWeight:600, marginBottom:'8px', letterSpacing:'0.08em' }}>
            ◈ ERROR IN {tabName.toUpperCase()} — ISOLATED
          </div>
          <div style={{ fontSize:'11px', color:'#aaa', marginBottom:'16px', lineHeight:1.6 }}>
            {this.state.error?.message || 'Unexpected error in this tab.'}
          </div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px' }}>
            <button
              onClick={retry}
              style={{ ...M, fontSize:'11px', padding:'6px 14px', background:'#e03030', color:'#fff', border:'none', cursor:'pointer', borderRadius:'3px' }}>
              ↻ Retry
            </button>
            <button
              onClick={() => this.handleExport()}
              style={{ ...M, fontSize:'11px', padding:'6px 14px', background:'transparent', color:'#f5c542', border:'1px solid #f5c542', cursor:'pointer', borderRadius:'3px' }}>
              ↓ Export Data
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ ...M, fontSize:'11px', padding:'6px 14px', background:'transparent', color:'#e03030', border:'1px solid #e03030', cursor:'pointer', borderRadius:'3px' }}>
              Reload App
            </button>
          </div>
          <button
            onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
            style={{ ...M, fontSize:'10px', padding:'4px 10px', background:'transparent', color:'#555', border:'1px solid #333', cursor:'pointer', borderRadius:'3px' }}>
            {this.state.showDetails ? '▲ Hide Details' : '▼ Technical Details'}
          </button>
          {this.state.showDetails && (
            <pre style={{ ...M, fontSize:'10px', color:'#666', background:'#0a0a0a', padding:'10px', borderRadius:'4px', marginTop:'8px', overflowX:'auto', whiteSpace:'pre-wrap', wordBreak:'break-all', maxHeight:'200px', overflow:'auto' }}>
              {this.state.error?.stack || String(this.state.error)}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
