import { useState, useEffect, useContext, useMemo } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { GLOSSARY_TERMS } from '../lib/constants.js'
import { getApiCache, setApiCache, normTR } from '../lib/formulas.js'

function highlightMatch(text, q) {
  if (!q || !text) return text
  const norm = normTR(text), nq = normTR(q)
  const idx = norm.indexOf(nq)
  if (idx < 0) return text
  return <>{text.slice(0,idx)}<mark style={{ background:'#ff660033', color:'inherit', padding:'0 1px', borderRadius:'2px' }}>{text.slice(idx,idx+q.length)}</mark>{text.slice(idx+q.length)}</>
}

const ARTICLES_KEY = 'sporeus-articles-cache'
const ARTICLES_TTL = 48 * 3600e3

function getArticlesCache() { try { const c=JSON.parse(localStorage.getItem(ARTICLES_KEY)); if(c&&Date.now()-c.ts<ARTICLES_TTL) return c.data } catch {} return null }
function setArticlesCache(d) { try { localStorage.setItem(ARTICLES_KEY,JSON.stringify({ts:Date.now(),data:d})) } catch {} }

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
    const cached = getApiCache()
    if (cached) { setApiTerms(cached); return }
    setLoading(true)
    fetch('https://sporeus.com/wp-json/wp/v2/posts?per_page=50&_fields=id,title,excerpt,link&categories=737')
      .then(r=>r.json())
      .then(data=>{
        const terms=data.map(p=>({
          id:p.id,
          term:p.title.rendered.replace(/&amp;/g,'&').replace(/&#8220;/g,'\u201c').replace(/&#8221;/g,'\u201d'),
          excerpt:(p.excerpt.rendered||'').replace(/<[^>]+>/g,'').trim().slice(0,200),
          link:p.link
        }))
        setApiCache(terms); setApiTerms(terms)
      })
      .catch(()=>{})
      .finally(()=>setLoading(false))
  }, [])

  // Fetch recent articles from sporeus.com (separate from glossary terms)
  useEffect(() => {
    const cached = getArticlesCache()
    if (cached) { setArticles(cached); return }
    setArticlesLoading(true)
    fetch('https://sporeus.com/wp-json/wp/v2/posts?per_page=10&_fields=id,title,excerpt,link,date,categories')
      .then(r=>r.json())
      .then(data=>{
        const arts=data.map(p=>({
          id:p.id,
          title:p.title.rendered.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&#8220;/g,'\u201c').replace(/&#8221;/g,'\u201d'),
          excerpt:(p.excerpt.rendered||'').replace(/<[^>]+>/g,'').trim().slice(0,120),
          link:p.link,
          date:p.date?.slice(0,10)||'',
          categories:p.categories||[],
        }))
        setArticlesCache(arts); setArticles(arts)
      })
      .catch(()=>{})
      .finally(()=>setArticlesLoading(false))
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
  }, [q, selLetter, allTerms.length])

  const letters = useMemo(() => {
    const s = new Set(allTerms.map(t2=>normTR(t2.term)[0]).filter(Boolean))
    return 'abcçdefghiıjklmnoöpqrsştuvüwxyz'.split('').filter(l=>s.has(l))
  }, [allTerms.length])

  const paginated = filtered.slice(0, page * PER_PAGE)
  const hasMore = filtered.length > paginated.length

  const resetFilters = () => { setQ(''); setSelLetter(''); setPage(1) }

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('glossTitle')}</div>
        <input style={S.input} type="text" placeholder={t('searchPlaceholder')} value={q}
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
            <div style={{ display:'flex', gap:'4px' }}>
              {['all','training','science'].map(f=>(
                <button key={f} onClick={()=>setArticleFilter(f)}
                  style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 7px', borderRadius:'3px', cursor:'pointer', border:`1px solid ${articleFilter===f?'#0064ff':'var(--border)'}`, background:articleFilter===f?'#0064ff22':'transparent', color:articleFilter===f?'#0064ff':'var(--muted)' }}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {articlesLoading && <div style={{ ...S.mono, fontSize:'11px', color:'#aaa', textAlign:'center', padding:'16px' }}>Loading…</div>}
          {articles.map((art,i)=>(
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
