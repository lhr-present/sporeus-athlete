import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('Sporeus tab error:', error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", background:'#1a0000', border:'1px solid #e03030', borderRadius:'6px', padding:'20px', margin:'20px', color:'#e5e5e5' }}>
          <div style={{ color:'#e03030', fontWeight:600, marginBottom:'8px' }}>◈ TAB ERROR — ISOLATED</div>
          <div style={{ fontSize:'11px', color:'#aaa', marginBottom:'12px' }}>{this.state.error?.message || 'Unexpected error in this tab.'}</div>
          <button onClick={() => this.setState({ hasError: false })} style={{ fontFamily:'inherit', fontSize:'11px', padding:'6px 14px', background:'#e03030', color:'#fff', border:'none', cursor:'pointer', borderRadius:'3px', marginRight:'8px' }}>↻ Retry</button>
          <button onClick={() => window.location.reload()} style={{ fontFamily:'inherit', fontSize:'11px', padding:'6px 14px', background:'transparent', color:'#e03030', border:'1px solid #e03030', cursor:'pointer', borderRadius:'3px' }}>Reload App</button>
        </div>
      )
    }
    return this.props.children
  }
}
