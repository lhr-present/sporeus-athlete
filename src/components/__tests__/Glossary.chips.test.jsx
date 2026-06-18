// @vitest-environment jsdom
// ─── Glossary — "Latest from sporeus.com" category chips (v9.438) ─────────────
// The chips used to set state but never filter the list (cosmetic). They are now
// dynamic (derived from the categories actually present in the fetched articles)
// and actually filter. These tests lock that behavior + the graceful fallback.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// Short-circuit the glossary-terms effect (return a cached value before it rate-limits)
// so the separate articles effect is free to fetch in the test.
vi.mock('../../lib/formulas.js', async (orig) => {
  const real = await orig()
  return { ...real, getApiCache: () => [], setApiCache: () => {} }
})

const posts = [
  { id: 1, title: { rendered: 'Post A' }, excerpt: { rendered: 'a' }, link: '#', date: '2026-01-02', categories: [10, 20] },
  { id: 2, title: { rendered: 'Post B' }, excerpt: { rendered: 'b' }, link: '#', date: '2026-01-01', categories: [10] },
]
let catResponse = [{ id: 10, name: 'Antrenman' }, { id: 20, name: 'Bilim' }]

vi.mock('../../lib/fetch.js', () => ({
  safeFetch: vi.fn(async (url) => ({
    json: async () => {
      if (url.includes('/categories?')) return catResponse
      if (url.includes('/posts')) return posts
      return []
    },
  })),
}))

import Glossary from '../Glossary.jsx'

beforeEach(() => {
  localStorage.clear()
  catResponse = [{ id: 10, name: 'Antrenman' }, { id: 20, name: 'Bilim' }]
})

describe('Glossary article category chips', () => {
  it('renders dynamic chips from resolved categories and filters by the selected one', async () => {
    renderWithLang(<Glossary />)
    await waitFor(() => expect(screen.getByText('Post A')).toBeInTheDocument())

    // chips derived from the articles' real categories (+ an ALL chip)
    const bilim = await screen.findByRole('button', { name: 'BILIM' })
    expect(screen.getByRole('button', { name: 'ANTRENMAN' })).toBeInTheDocument()
    expect(bilim).toBeInTheDocument()
    // both posts visible under ALL
    expect(screen.getByText('Post B')).toBeInTheDocument()

    // filter to "Bilim" (id 20) — only Post A carries that category
    fireEvent.click(bilim)
    await waitFor(() => expect(screen.queryByText('Post B')).toBeNull())
    expect(screen.getByText('Post A')).toBeInTheDocument()
  })

  it('hides the chip row entirely when category names cannot be resolved (graceful fallback)', async () => {
    catResponse = [] // category lookup yields nothing → no chips, articles still render
    renderWithLang(<Glossary />)
    await waitFor(() => expect(screen.getByText('Post A')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'ANTRENMAN' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^ALL$/ })).toBeNull()
    // articles unaffected by the missing chips
    expect(screen.getByText('Post B')).toBeInTheDocument()
  })
})
