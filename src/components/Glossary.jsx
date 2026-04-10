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

export default function Glossary() {
  const { t, lang } = useContext(LangCtx)
  const [q, setQ] = useState('')
  const [selLetter, setSelLetter] = useState('')
  const [apiTerms, setApiTerms] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
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
    </div>
  )
}
