// ─── PrivacyPolicy.jsx — KVKK + GDPR privacy policy (TR / EN) ─────────────────
// Accessible at ?privacy=1 query param.
// Self-contained bilingual page — no external deps, no markdown import.
import { useState } from 'react'

const MONO  = "'IBM Plex Mono', monospace"
const SANS  = "'IBM Plex Sans', sans-serif"
const ORANGE = '#ff6600'
const UPDATED = '2026-04-16'
const VERSION  = 'v1.1'

// ── Content (TR / EN) ─────────────────────────────────────────────────────────

const SECTIONS = {
  en: [
    {
      id: 'controller',
      title: '1. Data Controller',
      body: `
**Hüseyin Akbulut** ("Sporeus", "we", "us")
E-mail: huseyinakbulut71@gmail.com
Website: https://sporeus.com
Country of establishment: Republic of Türkiye

Sporeus operates the Sporeus Athlete Console web application ("App") and acts as data controller under Turkish Law No. 6698 (KVKK) and EU General Data Protection Regulation 2016/679 (GDPR).
`,
    },
    {
      id: 'data-collected',
      title: '2. Personal Data We Collect',
      body: `
When you create an account and use the App, we may collect:

- **Identity & contact:** name, e-mail address (from authentication provider)
- **Profile:** age, gender, primary sport, athlete level, goal
- **Training metrics:** sessions (type, duration, TSS, RPE, heart-rate zones, power, pace), test results (FTP, CP, VO2max, MaxHR, threshold pace), race results, injury notes
- **Recovery & wellness:** daily readiness scores, sleep hours, HRV readings, RESTQ questionnaire responses
- **Device & usage:** push notification subscription token, device sync log, browser/OS type (not stored server-side)
- **Authentication:** OAuth tokens (managed by Supabase Auth, not stored in our tables)
`,
    },
    {
      id: 'purpose',
      title: '3. Purpose and Legal Basis',
      body: `
| Purpose | Legal basis (GDPR) | KVKK basis |
|---|---|---|
| Deliver core app features (training analysis, zone calculation, plan generation) | Art. 6(1)(b) — contract performance | Art. 5(1)(c) — legitimate purpose |
| Store health/training data for your benefit | Art. 9(2)(a) — explicit consent | Art. 6(3) — explicit consent |
| Sync data across your devices | Art. 6(1)(b) — contract performance | Art. 5(1)(c) |
| Send push notifications you opted into | Art. 6(1)(a) — consent | Art. 5(1)(a) |
| Legal compliance and fraud prevention | Art. 6(1)(c) — legal obligation | Art. 5(1)(ç) |

Training and wellness data falls under **special categories** (health data) under Art. 9 GDPR and KVKK Art. 6. We process it only with your **explicit consent**, granted via the in-app consent gate.
`,
    },
    {
      id: 'sharing',
      title: '4. Data Sharing and Sub-processors',
      body: `
We do **not** sell or share your personal data with third parties for marketing.

We use the following sub-processors to operate the App:

- **Supabase, Inc.** (USA, EU Standard Contractual Clauses) — database hosting, authentication. Data stored in EU region (Frankfurt, AWS eu-central-1).
- **GitHub, Inc.** — static file hosting (GitHub Pages). No personal data is transmitted to GitHub during normal App use.

Coach accounts: if you connect to a coach within the App, your coach can view your training metrics and plan data as part of the coaching service.
`,
    },
    {
      id: 'retention',
      title: '5. Data Retention',
      body: `
We retain your training data for **3 years** from your last activity, consistent with KVKK Art. 7 and GDPR Art. 5(1)(e).

After 3 years of inactivity, data is automatically purged by our scheduled database process.

You may request immediate deletion at any time — see Section 6.
`,
    },
    {
      id: 'rights',
      title: '6. Your Rights',
      body: `
Under GDPR and KVKK you have the right to:

- **Access** — obtain a copy of your data (Profile → Privacy → "Download my data")
- **Rectification** — correct inaccurate data (edit your Profile)
- **Erasure (Art. 17)** — delete all your data (Profile → Privacy → "Delete my account")
- **Portability (Art. 20)** — receive your data in machine-readable JSON format
- **Restriction** — limit how we process your data (contact us)
- **Objection** — object to processing based on legitimate interests (contact us)
- **Withdraw consent** — at any time from Profile → Privacy Dashboard → "Withdraw consent"

To exercise rights not covered by the in-app tools, e-mail: **huseyinakbulut71@gmail.com**

We respond within **30 days**.

You also have the right to lodge a complaint with:
- **KVKK (TR):** Kişisel Verileri Koruma Kurumu — https://kvkk.gov.tr
- **Your local EU supervisory authority** (if you are in the EU/EEA)
`,
    },
    {
      id: 'cookies',
      title: '7. Cookies and Local Storage',
      body: `
The App uses:

- **Session cookie (essential):** Set by Supabase Auth for your login session. This is strictly necessary for authentication — no consent required under ePrivacy Directive.
- **localStorage (functional):** Training data, preferences, and settings are stored in your browser's localStorage. This data stays on your device; it is not a tracking cookie.

We do **not** use advertising, analytics, or tracking cookies. We do not deploy third-party scripts (Google Analytics, Meta Pixel, etc.).
`,
    },
    {
      id: 'security',
      title: '8. Security',
      body: `
Data is transmitted over HTTPS. Supabase enforces row-level security (RLS) so users can only read their own records. Passwords are hashed by Supabase Auth (bcrypt). We do not store raw passwords.
`,
    },
    {
      id: 'changes',
      title: '9. Changes to This Policy',
      body: `
We will notify you of material changes via the in-app consent gate (which re-prompts for consent on version upgrade). The current version is **${VERSION}** (last updated ${UPDATED}).
`,
    },
    {
      id: 'contact',
      title: '10. Contact',
      body: `
Hüseyin Akbulut · huseyinakbulut71@gmail.com · sporeus.com
`,
    },
  ],

  tr: [
    {
      id: 'controller',
      title: '1. Veri Sorumlusu',
      body: `
**Hüseyin Akbulut** ("Sporeus", "biz")
E-posta: huseyinakbulut71@gmail.com
Web sitesi: https://sporeus.com
Kurulum ülkesi: Türkiye Cumhuriyeti

Sporeus, Sporeus Athlete Console web uygulamasını ("Uygulama") işletmekte olup 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve AB Genel Veri Koruma Yönetmeliği 2016/679 (GDPR) kapsamında **veri sorumlusu** sıfatını taşımaktadır.
`,
    },
    {
      id: 'data-collected',
      title: '2. Topladığımız Kişisel Veriler',
      body: `
Hesap oluşturup Uygulamayı kullandığınızda aşağıdaki veriler toplanabilir:

- **Kimlik & iletişim:** ad, e-posta adresi (kimlik doğrulama sağlayıcısından)
- **Profil:** yaş, cinsiyet, ana spor dalı, sporcu seviyesi, hedef
- **Antrenman metrikleri:** seanslar (tür, süre, TSS, RPE, kalp atışı bölgeleri, güç, hız), test sonuçları (FTP, CP, VO2max, MaxKAH, eşik hızı), yarış sonuçları, sakatlanma notları
- **Toparlanma & sağlık:** günlük hazırlık skoru, uyku saatleri, HRV ölçümleri, RESTQ anketi yanıtları
- **Cihaz & kullanım:** anlık bildirim abonelik tokeni, cihaz senkron günlüğü
`,
    },
    {
      id: 'purpose',
      title: '3. İşleme Amaçları ve Hukuki Dayanaklar',
      body: `
| Amaç | GDPR dayanağı | KVKK dayanağı |
|---|---|---|
| Temel uygulama özellikleri (analiz, bölge hesabı, plan) | Md. 6(1)(b) — sözleşme | Md. 5(1)(c) — meşru amaç |
| Sağlık/antrenman verilerini saklama | Md. 9(2)(a) — açık rıza | Md. 6(3) — açık rıza |
| Cihazlar arası senkronizasyon | Md. 6(1)(b) — sözleşme | Md. 5(1)(c) |
| Onayladığınız anlık bildirimler | Md. 6(1)(a) — rıza | Md. 5(1)(a) |
| Yasal uyum ve dolandırıcılık önleme | Md. 6(1)(c) — yasal yükümlülük | Md. 5(1)(ç) |

Antrenman ve sağlık verileri GDPR Md. 9 ve KVKK Md. 6 kapsamında **özel nitelikli kişisel veri** sayılmaktadır. Bu veriler yalnızca uygulama içi rıza ekranında verilen **açık rızanıza** dayanılarak işlenmektedir.
`,
    },
    {
      id: 'sharing',
      title: '4. Veri Paylaşımı ve Alt İşleyiciler',
      body: `
Kişisel verilerinizi **pazarlama amaçlı üçüncü taraflarla paylaşmıyor ve satmıyoruz**.

Uygulamayı işletmek için kullandığımız alt işleyiciler:

- **Supabase, Inc.** (ABD, AB Standart Sözleşme Maddeleri) — veritabanı barındırma, kimlik doğrulama. Veriler AB bölgesinde (Frankfurt, AWS eu-central-1) saklanmaktadır.
- **GitHub, Inc.** — statik dosya barındırma (GitHub Pages). Normal uygulama kullanımında GitHub'a kişisel veri iletilmemektedir.

Antrenör hesabı: Uygulama içinde bir antrenöre bağlanırsanız, antrenörünüz koçluk hizmeti kapsamında antrenman metriklerinizi ve plan verilerinizi görebilir.
`,
    },
    {
      id: 'retention',
      title: '5. Saklama Süresi',
      body: `
Antrenman verileriniz, son aktiviteden itibaren **3 yıl** süreyle saklanmaktadır (KVKK Md. 7 ve GDPR Md. 5(1)(e)).

3 yıllık işlem yapılmayan dönem sonunda veriler otomatik olarak silinmektedir.

Dilediğiniz zaman silme talebinde bulunabilirsiniz (bkz. Bölüm 6).
`,
    },
    {
      id: 'rights',
      title: '6. İlgili Kişi Haklarınız',
      body: `
KVKK Md. 11 ve GDPR kapsamında sahip olduğunuz haklar:

- **Erişim** — verilerinizin bir kopyasını alabilirsiniz (Profil → Gizlilik → "Verilerimi indir")
- **Düzeltme** — hatalı verileri düzeltebilirsiniz (Profilinizi düzenleyin)
- **Silme (Md. 17)** — tüm verilerinizi silebilirsiniz (Profil → Gizlilik → "Hesabımı sil")
- **Taşınabilirlik** — verilerinizi makine tarafından okunabilir JSON formatında alabilirsiniz
- **Kısıtlama** — işlemeyi sınırlayabilirsiniz (bize ulaşın)
- **İtiraz** — meşru menfaate dayalı işleme itiraz edebilirsiniz (bize ulaşın)
- **Rızanızı geri çekme** — Profil → Gizlilik Paneli → "Rızamı geri al"

Uygulama içi araçlarla karşılanamayan talepler için: **huseyinakbulut71@gmail.com**

Taleplerinize **30 gün** içinde yanıt verilir.

Şikâyet başvurusu yapabileceğiniz makam:
- **KVK Kurumu:** https://kvkk.gov.tr — Başvuru formu ve iletişim bilgileri
`,
    },
    {
      id: 'cookies',
      title: '7. Çerezler ve Yerel Depolama',
      body: `
Uygulama aşağıdakileri kullanmaktadır:

- **Oturum çerezi (zorunlu):** Giriş oturumunuz için Supabase Auth tarafından oluşturulur. Bu çerez kimlik doğrulama için kesinlikle gereklidir; ePrivacy Direktifi kapsamında rıza gerekmez.
- **Yerel depolama (işlevsel):** Antrenman verileri, tercihler ve ayarlar tarayıcınızın localStorage alanında saklanır. Bu veri cihazınızda kalır; izleme çerezi değildir.

**Reklam, analitik veya izleme çerezi kullanmıyoruz.** Üçüncü taraf script (Google Analytics, Meta Pixel vb.) dağıtmıyoruz.
`,
    },
    {
      id: 'security',
      title: '8. Güvenlik',
      body: `
Veriler HTTPS üzerinden iletilmektedir. Supabase, kullanıcıların yalnızca kendi kayıtlarına erişebileceği satır düzeyinde güvenlik (RLS) politikası uygulamaktadır. Şifreler Supabase Auth tarafından bcrypt ile şifrelenmektedir; ham şifre saklanmamaktadır.
`,
    },
    {
      id: 'changes',
      title: '9. Politika Değişiklikleri',
      body: `
Önemli değişiklikler uygulama içi rıza ekranı aracılığıyla size bildirilecektir (sürüm yükseltmelerinde yeniden rıza talep edilir). Mevcut sürüm: **${VERSION}** (son güncelleme: ${UPDATED}).
`,
    },
    {
      id: 'contact',
      title: '10. İletişim',
      body: `
Hüseyin Akbulut · huseyinakbulut71@gmail.com · sporeus.com
`,
    },
  ],
}

// ── Minimal inline markdown renderer ─────────────────────────────────────────
function renderBody(text) {
  const lines = text.trim().split('\n')
  const result = []
  let tableRows = []
  let inTable = false
  let key = 0

  const flushTable = () => {
    if (!tableRows.length) return
    const [head, , ...body] = tableRows
    const headers = head.split('|').filter(Boolean).map(s => s.trim())
    const rows = body.map(r => r.split('|').filter(Boolean).map(s => s.trim()))
    result.push(
      <table key={key++} style={{ borderCollapse:'collapse', width:'100%', margin:'10px 0', fontSize:'11px' }}>
        <thead>
          <tr>{headers.map((h,i) => <th key={i} style={{ border:'1px solid #2a2a2a', padding:'4px 10px', textAlign:'left', color:'#ff6600', fontFamily:MONO, fontWeight:600 }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r,ri) => <tr key={ri}>{r.map((c,ci) => <td key={ci} style={{ border:'1px solid #2a2a2a', padding:'4px 10px', color:'#ccc', fontFamily:MONO }}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    )
    tableRows = []
    inTable = false
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.startsWith('|')) {
      if (!inTable) inTable = true
      tableRows.push(line)
      continue
    }
    if (inTable) flushTable()
    if (!line) { result.push(<br key={key++}/>); continue }

    // Bold + plain inline render
    const renderInline = (str) => {
      const parts = str.split(/(\*\*[^*]+\*\*)/g)
      return parts.map((p, i) => p.startsWith('**') ? <strong key={i} style={{ color:'#fff' }}>{p.slice(2,-2)}</strong> : p)
    }

    if (line.startsWith('- ')) {
      result.push(<li key={key++} style={{ color:'#ccc', fontFamily:MONO, fontSize:'11px', marginBottom:'3px' }}>{renderInline(line.slice(2))}</li>)
    } else {
      result.push(<p key={key++} style={{ color:'#ccc', fontFamily:MONO, fontSize:'11px', lineHeight:1.7, margin:'6px 0' }}>{renderInline(line)}</p>)
    }
  }
  if (inTable) flushTable()
  return result
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PrivacyPolicy() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('sporeus-lang') || 'en' } catch { return 'en' }
  })
  const sections = SECTIONS[lang] || SECTIONS.en
  const isTR = lang === 'tr'

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#ccc',
      fontFamily: SANS,
      padding: '24px 20px 80px',
      maxWidth: '800px',
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'32px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <div style={{ fontFamily:MONO, fontSize:'20px', fontWeight:700, color:ORANGE, letterSpacing:'0.08em' }}>◈ SPOREUS</div>
          <div style={{ fontFamily:MONO, fontSize:'11px', color:'#555', marginTop:'4px', letterSpacing:'0.1em' }}>
            {isTR ? 'GİZLİLİK POLİTİKASI' : 'PRIVACY POLICY'} · {VERSION} · {UPDATED}
          </div>
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          {['en','tr'].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              fontFamily: MONO, fontSize:'11px', fontWeight:700, padding:'5px 12px',
              borderRadius:'3px', border:'none', cursor:'pointer',
              background: lang === l ? ORANGE : '#1a1a1a',
              color: lang === l ? '#fff' : '#555',
              letterSpacing:'0.08em',
            }}>{l.toUpperCase()}</button>
          ))}
          <button
            onClick={() => window.close() || window.history.back()}
            style={{ fontFamily:MONO, fontSize:'11px', padding:'5px 12px', background:'transparent', border:'1px solid #2a2a2a', color:'#555', borderRadius:'3px', cursor:'pointer' }}
          >← {isTR ? 'Geri' : 'Back'}</button>
        </div>
      </div>

      {/* Lead summary */}
      <div style={{ background:'#111', border:'1px solid #222', borderLeft:`3px solid ${ORANGE}`, borderRadius:'6px', padding:'14px 18px', marginBottom:'32px', fontFamily:MONO, fontSize:'11px', color:'#aaa', lineHeight:1.7 }}>
        {isTR
          ? 'Sporeus, antrenman verilerinizi yalnızca sportif performansınızı değerlendirmek amacıyla işler. Veri satmıyor, reklam göstermiyor, analitik takip kullanmıyoruz.'
          : 'Sporeus processes your training data solely to evaluate your athletic performance. We do not sell data, show ads, or deploy analytics tracking.'}
      </div>

      {/* Sections */}
      {sections.map(sec => (
        <section key={sec.id} id={sec.id} style={{ marginBottom:'28px', paddingBottom:'20px', borderBottom:'1px solid #111' }}>
          <h2 style={{ fontFamily:MONO, fontSize:'12px', fontWeight:700, color:ORANGE, letterSpacing:'0.1em', marginBottom:'12px', marginTop:0 }}>
            {sec.title}
          </h2>
          <div>{renderBody(sec.body)}</div>
        </section>
      ))}

      {/* Footer */}
      <div style={{ fontFamily:MONO, fontSize:'9px', color:'#333', textAlign:'center', marginTop:'40px', letterSpacing:'0.08em' }}>
        SPOREUS ATHLETE CONSOLE · SPOREUS.COM · huseyinakbulut71@gmail.com
      </div>
    </div>
  )
}
