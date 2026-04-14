// ─── content.js — sporeus.com content pipeline ────────────────────────────────
// Fetches related articles from sporeus.com WordPress REST API.
// Cache: localStorage 'sporeus-content-cache' with 24h TTL per topic+lang key.

import { safeFetch } from './fetch.js'

const CACHE_KEY = 'sporeus-content-cache'
const TTL_MS = 24 * 60 * 60 * 1000  // 24 hours

// getRelatedArticles(topic, lang = 'en')
// Returns [{title, url, excerpt}] — max 3 articles
// Calls: https://sporeus.com/wp-json/wp/v2/posts?search={topic}&per_page=3&lang={lang}
// Uses safeFetch from ./fetch.js for timeout + retry
// Returns [] on any error (never throws)
export async function getRelatedArticles(topic, lang = 'en') {
  if (!topic) return []
  const cacheKey = `${topic}:${lang}`

  // Check cache
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const cache = JSON.parse(raw)
      const entry = cache[cacheKey]
      if (entry && (Date.now() - entry.ts) < TTL_MS) {
        return entry.articles
      }
    }
  } catch {}

  // Fetch from WordPress REST API
  try {
    const url = `https://sporeus.com/wp-json/wp/v2/posts?search=${encodeURIComponent(topic)}&per_page=3&_fields=title,link,excerpt${lang !== 'en' ? '&lang=' + lang : ''}`
    const res = await safeFetch(url)
    const data = await res.json()
    if (!Array.isArray(data)) return []
    const articles = data.map(post => ({
      title:   post.title?.rendered ? post.title.rendered.replace(/<[^>]*>/g, '') : '',
      url:     post.link || '',
      excerpt: post.excerpt?.rendered ? post.excerpt.rendered.replace(/<[^>]*>/g, '').slice(0, 120) + '...' : '',
    })).filter(a => a.title && a.url)

    // Store in cache
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      const cache = raw ? JSON.parse(raw) : {}
      cache[cacheKey] = { ts: Date.now(), articles }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    } catch {}

    return articles
  } catch {
    return []
  }
}

// clearContentCache()
// Removes the content cache from localStorage
export function clearContentCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}
