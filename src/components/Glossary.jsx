import { useState, useEffect, useContext, useMemo } from 'react'
import { logger } from '../lib/logger.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { GLOSSARY_TERMS } from '../lib/constants.js'
import { getApiCache, setApiCache, normTR } from '../lib/formulas.js'
import { safeFetch } from '../lib/fetch.js'

function highlightMatch(text, q) {
  if (!q || !text) return text
  const norm = normTR(text), nq = normTR(q)
  const idx = norm.indexOf(nq)
  if (idx < 0) return text
  return <>{text.slice(0,idx)}<mark style={{ background:'#ff660033', color:'inherit', padding:'0 1px', borderRadius:'2px' }}>{text.slice(idx,idx+q.length)}</mark>{text.slice(idx+q.length)}</>
}

const ARTICLES_KEY = 'sporeus-articles-cache'
const ARTICLES_TTL = 48 * 3600e3
const RATE_KEY = 'sporeus-api-last-fetch'
const MIN_INTERVAL = 5 * 60 * 1000 // 5 minutes between fetches

function getArticlesCache() { try { const c=JSON.parse(localStorage.getItem(ARTICLES_KEY)); if(c&&Date.now()-c.ts<ARTICLES_TTL) return c.data } catch (e) { logger.warn('localStorage:', e.message) } return null }
function setArticlesCache(d) { try { localStorage.setItem(ARTICLES_KEY,JSON.stringify({ts:Date.now(),data:d})) } catch (e) { logger.warn('localStorage:', e.message) } }
function canFetchApi() { try { return Date.now() - parseInt(localStorage.getItem(RATE_KEY)||'0') >= MIN_INTERVAL } catch { return true } }
function markApiFetched() { try { localStorage.setItem(RATE_KEY, String(Date.now())) } catch (e) { logger.warn('localStorage:', e.message) } }

async function fetchJson(url) {
  const res = await safeFetch(url)
  return res.json()
}

export default function Glossary() {
  const { t, lang } = useContext(LangCtx)
  const [q, setQ] = useState('')
  const [selLetter, setSelLetter] = useState('')
  const [apiTerms, setApiTerms] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [articles, setArticles] = useState([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [articleFilter, setArticleFilter] = useState('all')
  const PER_PAGE = 20

  useEffect(() => {
    let alive = true
    const cached = getApiCache()
    if (cached) { setApiTerms(cached); return }
    if (!canFetchApi()) return
    setLoading(true)
    markApiFetched()
    fetchJson('https://sporeus.com/wp-json/wp/v2/posts?per_page=50&_fields=id,title,excerpt,link&categories=737')
      .then(data=>{
        const terms=data.map(p=>({
          id:p.id,
          term:p.title.rendered.replace(/&amp;/g,'&').replace(/&#8220;/g,'\u201c').replace(/&#8221;/g,'\u201d'),
          excerpt:(p.excerpt.rendered||'').replace(/<[^>]+>/g,'').trim().slice(0,200),
          link:p.link
        }))
        setApiCache(terms); if (alive) setApiTerms(terms)
      })
      .catch(()=>{})
      .finally(()=>{ if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Fetch recent articles from sporeus.com (separate from glossary terms). Also resolves the
  // articles' category names so the filter chips below are real (best-effort: if the category
  // lookup fails, articles still render and the chips simply stay hidden \u2014 never broken).
  useEffect(() => {
    let alive = true
    const cached = getArticlesCache()
    if (cached) { setArticles(cached); return }
    if (!canFetchApi()) return
    setArticlesLoading(true)
    markApiFetched()
    ;(async () => {
      try {
        const data = await fetchJson('https://sporeus.com/wp-json/wp/v2/posts?per_page=10&_fields=id,title,excerpt,link,date,categories')
        const arts = data.map(p=>({
          id:p.id,
          title:p.title.rendered.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&#8220;/g,'\u201c').replace(/&#8221;/g,'\u201d'),
          excerpt:(p.excerpt.rendered||'').replace(/<[^>]+>/g,'').trim().slice(0,120),
          link:p.link,
          date:p.date?.slice(0,10)||'',
          categories:p.categories||[],
          cats:[], // [{id,name}] \u2014 filled below when category names resolve
        }))
        const ids = [...new Set(arts.flatMap(a=>a.categories))]
        if (ids.length) {
          try {
            const cats = await fetchJson(`https://sporeus.com/wp-json/wp/v2/categories?include=${ids.join(',')}&per_page=100&_fields=id,name`)
            const nameById = {}
            cats.forEach(c=>{ nameById[c.id] = (c.name||'').replace(/&amp;/g,'&') })
            arts.forEach(a=>{ a.cats = a.categories.map(id=>nameById[id] ? { id, name:nameById[id] } : null).filter(Boolean) })
          } catch (e) { logger.warn('article categories:', e.message) } // names optional
        }
        setArticlesCache(arts); if (alive) setArticles(arts)
      } catch (e) {
        logger.warn('articles fetch:', e.message)
      } finally {
        if (alive) setArticlesLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const allTerms = [...apiTerms, ...GLOSSARY_TERMS]

  const filtered = useMemo(() => {
    let list = allTerms
    if (selLetter) list = list.filter(t2 => normTR(t2.term)[0] === selLetter.toLowerCase())
    if (!q) return list.sort((a,b)=>normTR(a.term).localeCompare(normTR(b.term)))
    const nq = normTR(q)
    return list
      .map(t2 => {
        const nt = normTR(t2.term), nb = normTR(t2.en||t2.excerpt||''), ntr = normTR(t2.tr||'')
        const score = nt.startsWith(nq) ? 3 : nt.includes(nq) ? 2 : (nb.includes(nq)||ntr.includes(nq)) ? 1 : 0
        return { ...t2, _score:score }
      })
      .filter(t2=>t2._score>0)
      .sort((a,b)=>b._score-a._score)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- allTerms is derived from a stable constant; .length is the change signal
  }, [q, selLetter, allTerms.length])

  const letters = useMemo(() => {
    const s = new Set(allTerms.map(t2=>normTR(t2.term)[0]).filter(Boolean))
    return 'abcçdefghiıjklmnoöpqrsştuvüwxyz'.split('').filter(l=>s.has(l))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- same reason
  }, [allTerms.length])

  const paginated = filtered.slice(0, page * PER_PAGE)
  const hasMore = filtered.length > paginated.length

  // Real, dynamic category chips for "Latest from sporeus.com" — derived from the categories
  // that actually appear in the fetched articles (top 4 by frequency). Empty unless ≥2 distinct
  // categories resolve, so the chip row only shows when filtering is meaningful.
  const articleCats = useMemo(() => {
    const m = new Map() // id -> { id, name, count }
    articles.forEach(a => (a.cats||[]).forEach(c => {
      const e = m.get(c.id) || { id:c.id, name:c.name, count:0 }
      e.count++; m.set(c.id, e)
    }))
    return [...m.values()].sort((a,b)=>b.count-a.count).slice(0,4)
  }, [articles])

  const shownArticles = useMemo(() =>
    articleFilter==='all' ? articles : articles.filter(a => (a.cats||[]).some(c=>c.id===articleFilter)),
    [articles, articleFilter])

  const resetFilters = () => { setQ(''); setSelLetter(''); setPage(1) }

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('glossTitle')}</div>
        <input style={S.input} type="text" aria-label={t('searchPlaceholder')} placeholder={t('searchPlaceholder')} value={q}
          onChange={e=>{ setQ(e.target.value); setSelLetter(''); setPage(1) }}/>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'3px', marginTop:'10px' }}>
          {letters.map(l=>(
            <button key={l} onClick={()=>{ setSelLetter(selLetter===l?'':l); setQ(''); setPage(1) }}
              style={{ ...S.mono, fontSize:'10px', fontWeight:600, width:'22px', height:'22px', borderRadius:'3px', cursor:'pointer', border:'1px solid var(--border)', background:selLetter===l?'#0064ff':'transparent', color:selLetter===l?'#fff':'var(--sub)', padding:0, textAlign:'center' }}>
              {l.toUpperCase()}
            </button>
          ))}
          {(selLetter||q) && (
            <button onClick={resetFilters} style={{ ...S.mono, fontSize:'9px', padding:'0 6px', height:'22px', borderRadius:'3px', cursor:'pointer', border:'1px solid #e03030', background:'transparent', color:'#e03030' }}>✕ Clear</button>
          )}
        </div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'8px' }}>
          {loading ? t('loadingTerms') : `${filtered.length} / ${allTerms.length} terms`}
          {apiTerms.length>0 && !loading && <span style={{ color:'#5bc25b', marginLeft:'8px' }}>• {t('apiTermsLabel')}</span>}
        </div>
      </div>

      {paginated.map((term,i)=>{
        const isApi = !!term.id
        const body = isApi ? term.excerpt : (lang==='tr'&&term.tr ? term.tr : term.en)
        return (
          <div key={term.id||term.term} className="sp-card"
            style={{ ...S.card, marginBottom:'10px', animationDelay:`${Math.min(i*20,200)}ms` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
              <div style={{ ...S.mono, fontSize:'14px', fontWeight:600, color:'#0064ff', marginBottom:'8px' }}>
                {highlightMatch(term.term, q)}
              </div>
              {isApi && <span style={S.tag('#5bc25b')}>API</span>}
            </div>
            <div style={{ fontSize:'14px', lineHeight:1.7, color:'var(--text)' }}>{body}</div>
            {isApi && term.link && (
              <a href={term.link} target="_blank" rel="noreferrer"
                style={{ ...S.mono, fontSize:'11px', color:'#0064ff', textDecoration:'none', display:'block', marginTop:'8px' }}>
                {t('readMoreLink')}
              </a>
            )}
          </div>
        )
      })}

      {hasMore && (
        <button onClick={()=>setPage(p=>p+1)}
          style={{ ...S.btnSec, width:'100%', marginBottom:'16px' }}>
          Show more ({filtered.length - paginated.length} remaining)
        </button>
      )}

      {filtered.length===0&&!loading&&(
        <div style={{ textAlign:'center', ...S.mono, fontSize:'12px', color:'#aaa', padding:'40px 0' }}>No terms match.</div>
      )}

      {/* Latest from sporeus.com */}
      {(articles.length > 0 || articlesLoading) && !q && !selLetter && (
        <div style={{ marginTop:'8px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', ...S.card, marginBottom:'8px' }}>
            <div style={S.cardTitle}>LATEST FROM SPOREUS.COM</div>
            {articleCats.length >= 2 && (
              <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', justifyContent:'flex-end' }}>
                {[{ id:'all', name: lang==='tr'?'TÜMÜ':'ALL' }, ...articleCats].map(c=>(
                  <button key={c.id} onClick={()=>setArticleFilter(c.id)}
                    style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 7px', borderRadius:'3px', cursor:'pointer', border:`1px solid ${articleFilter===c.id?'#0064ff':'var(--border)'}`, background:articleFilter===c.id?'#0064ff22':'transparent', color:articleFilter===c.id?'#0064ff':'var(--muted)' }}>
                    {c.name.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
          {articlesLoading && <div style={{ ...S.mono, fontSize:'11px', color:'#aaa', textAlign:'center', padding:'16px' }}>Loading…</div>}
          {shownArticles.map((art,i)=>(
            <div key={art.id} className="sp-card" style={{ ...S.card, marginBottom:'8px', animationDelay:`${i*30}ms` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
                <a href={art.link} target="_blank" rel="noreferrer" style={{ ...S.mono, fontSize:'13px', fontWeight:600, color:'#0064ff', textDecoration:'none', flex:1 }}>{art.title}</a>
                <span style={{ ...S.mono, fontSize:'9px', color:'#888', whiteSpace:'nowrap' }}>{art.date}</span>
              </div>
              {art.excerpt && <div style={{ fontSize:'12px', color:'var(--sub)', lineHeight:1.6, marginTop:'6px' }}>{art.excerpt}…</div>}
              <a href={art.link} target="_blank" rel="noreferrer" style={{ ...S.mono, fontSize:'10px', color:'#0064ff', textDecoration:'none', display:'block', marginTop:'6px' }}>{t('readMoreLink')}</a>
            </div>
          ))}
          <div style={{ ...S.mono, fontSize:'9px', color:'#888', textAlign:'center', marginBottom:'8px' }}>Cached 48h · sporeus.com</div>
        </div>
      )}
    </div>
  )
}
