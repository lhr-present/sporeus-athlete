// @vitest-environment jsdom
// ─── GlobalSearch renderSnippet — XSS injection guard ─────────────────────────
// renderSnippet is the app's only dangerouslySetInnerHTML sink. It renders
// Postgres ts_headline snippets (which can contain coach/athlete-authored text)
// by escaping & < > FIRST, then restoring ONLY <b>…</b> → <mark>. These tests lock
// that contract: a reorder (restore before escape) or a broadened restore regex
// would execute injected markup and FAIL here.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderSnippet } from '../GlobalSearch.jsx'

describe('renderSnippet — XSS guard', () => {
  it('restores ts_headline <b> highlights as a safe <mark>', () => {
    const { container } = render(<div>{renderSnippet('an <b>easy</b> run')}</div>)
    const mark = container.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark.textContent).toBe('easy')
    expect(container.textContent).toContain('an easy run')
  })

  it('does NOT create a live <img> node from an onerror payload', () => {
    const { container } = render(
      <div>{renderSnippet('hi <img src=x onerror="alert(1)"> there')}</div>,
    )
    expect(container.querySelector('img')).toBeNull()
    // the markup survives only as inert escaped text
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">')
  })

  it('does NOT create a live <script> node', () => {
    const { container } = render(
      <div>{renderSnippet('<script>alert(document.cookie)</script>')}</div>,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<script>alert(document.cookie)</script>')
  })

  it('escapes injected markup even when combined with a legit <b> highlight', () => {
    const { container } = render(
      <div>{renderSnippet('<b>match</b><img src=x onerror=alert(1)>')}</div>,
    )
    // the legitimate highlight still renders…
    expect(container.querySelector('mark')?.textContent).toBe('match')
    // …but the injected img does not
    expect(container.querySelector('img')).toBeNull()
  })

  it('does not resurrect markup hidden behind a pre-escaped entity (no double-decode)', () => {
    // If the sanitiser decoded entities before escaping, this would become a live tag.
    const { container } = render(<div>{renderSnippet('&lt;img src=x onerror=alert(1)&gt;')}</div>)
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders nothing for empty/falsy input', () => {
    expect(renderSnippet('')).toBeNull()
    expect(renderSnippet(null)).toBeNull()
    expect(renderSnippet(undefined)).toBeNull()
  })
})
