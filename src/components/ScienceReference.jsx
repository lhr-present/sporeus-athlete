// ─── ScienceReference.jsx — renders docs/science.md as a standalone page ──────
// Accessed via ?science=1 in URL, or when window.location.pathname ends in /science
// Uses Vite ?raw import — no react-markdown dependency needed.
// IBM Plex Mono aesthetic: black bg, #ff6600 headings, #ccc body text.
import { useEffect, useRef } from 'react'
import scienceMd from '../../docs/science.md?raw'

const MONO = "'IBM Plex Mono', monospace"

// ── Minimal Markdown renderer (headings, code, bold, links, tables, lists) ─────
// Converts the science.md subset of Markdown to React-renderable HTML string,
// then uses dangerouslySetInnerHTML. Content is static/internal — no XSS risk.

function mdToHtml(md) {
  let html = md
    // Headings — add id for anchor navigation
    .replace(/^#{1} (.+)$/gm, (_, t) => `<h1 id="${slugify(t)}">${t}</h1>`)
    .replace(/^#{2} (.+)$/gm, (_, t) => `<h2 id="${slugify(t)}">${t}</h2>`)
    .replace(/^#{3} (.+)$/gm, (_, t) => `<h3 id="${slugify(t)}">${t}</h3>`)
    // Horizontal rules
    .replace(/^---$/gm, '<hr/>')
    // Code blocks (fenced)
    .replace(/```[\w]*\n([\s\S]*?)```/gm, (_, c) => `<pre><code>${escHtml(c.trim())}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Table rows — basic support
    .replace(/^\|(.+)\|$/gm, (_, row) => {
      const cells = row.split('|').map(c => c.trim())
      // Detect separator row (---|---)
      if (cells.every(c => /^[-: ]+$/.test(c))) return '<tr class="sep"></tr>'
      return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`
    })
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs — blank-line separated blocks
    .replace(/\n\n+/g, '\n\n')

  // Wrap consecutive <li> into <ul>
  html = html.replace(/(<li>[\s\S]+?<\/li>)(?=\s*(?:<li>|<\/ul>|<h|<p|<pre|<hr|$))/g, '<ul>$1</ul>')
  // Wrap consecutive <tr> into <table>
  html = html.replace(/(<tr[\s\S]+?<\/tr>(?:\s*<tr[\s\S]+?<\/tr>)*)/g, (_, rows) => {
    // Remove separator rows from output
    const cleaned = rows.replace(/<tr class="sep"><\/tr>/g, '')
    return `<table>${cleaned}</table>`
  })
  // Remaining lines that aren't block elements → wrap in <p>
  html = html
    .split('\n\n')
    .map(block => {
      const t = block.trim()
      if (!t) return ''
      if (/^<(h[1-6]|ul|ol|pre|table|hr|li)/.test(t)) return t
      return `<p>${t.replace(/\n/g, ' ')}</p>`
    })
    .join('\n')

  return html
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ── ScienceReference component ────────────────────────────────────────────────
export default function ScienceReference() {
  const containerRef = useRef(null)

  useEffect(() => {
    // Scroll to hash anchor on mount
    const hash = window.location.hash.slice(1)
    if (hash && containerRef.current) {
      const target = containerRef.current.querySelector(`#${CSS.escape(hash)}`)
      if (target) {
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      }
    }
  }, [])

  const html = mdToHtml(scienceMd)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#ccc',
        fontFamily: MONO,
        padding: '24px 20px 60px',
        maxWidth: '860px',
        margin: '0 auto',
        fontSize: '12px',
        lineHeight: 1.6,
      }}
    >
      <style>{`
        .sp-science h1 { color: #ff6600; font-size: 16px; margin: 24px 0 12px; letter-spacing: 0.08em; }
        .sp-science h2 { color: #ff6600; font-size: 13px; margin: 28px 0 10px; border-bottom: 1px solid #222; padding-bottom: 4px; }
        .sp-science h3 { color: #e0a030; font-size: 11px; margin: 18px 0 8px; }
        .sp-science p  { color: #ccc; margin: 8px 0; }
        .sp-science pre { background: #111; border: 1px solid #222; border-radius: 2px; padding: 10px 14px; overflow-x: auto; }
        .sp-science code { font-family: ${MONO}; font-size: 10px; color: #ff9944; background: #111; padding: 1px 4px; border-radius: 2px; }
        .sp-science pre code { background: transparent; padding: 0; color: #ccc; }
        .sp-science a { color: #0064ff; text-decoration: none; }
        .sp-science a:hover { text-decoration: underline; }
        .sp-science ul { color: #ccc; padding-left: 20px; margin: 6px 0; }
        .sp-science li { margin: 3px 0; }
        .sp-science hr { border: none; border-top: 1px solid #1a1a1a; margin: 24px 0; }
        .sp-science table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 11px; }
        .sp-science td { border: 1px solid #222; padding: 4px 10px; color: #ccc; }
        .sp-science strong { color: #fff; }
      `}</style>
      <div
        ref={containerRef}
        className="sp-science"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
