// src/components/GeneralFitness.jsx — General Fitness track root
// Tabs: Today | Log | Program | Insights
import { useState, lazy, Suspense } from 'react'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import ErrorBoundary from './ErrorBoundary.jsx'
import OnboardingWizard from './general/OnboardingWizard.jsx'
import { advanceRotation } from '../lib/athlete/strengthTraining.js'

const GeneralDashboard       = lazy(() => import('./general/GeneralDashboard.jsx'))
const SessionLogger          = lazy(() => import('./general/SessionLogger.jsx'))
const ProgramView            = lazy(() => import('./general/ProgramView.jsx'))
const ProgramTemplateGallery = lazy(() => import('./general/ProgramTemplateGallery.jsx'))
const GeneralInsights        = lazy(() => import('./general/GeneralInsights.jsx'))

const INNER_TABS = [
  { id: 'today',    en: 'TODAY',    tr: 'BUGÜN' },
  { id: 'log',      en: 'LOG',      tr: 'KAYIT' },
  { id: 'program',  en: 'PROGRAM',  tr: 'PROGRAM' },
  { id: 'insights', en: 'INSIGHTS', tr: 'ANALİTİK' },
]

// ── Program templates (client-side seed — offline / no-Supabase) ─────────────
export const STATIC_TEMPLATES = [
  { id:'bw_starter_3day',       name_en:'Bodyweight Starter 3-Day',       name_tr:'Vücut Ağırlığı Başlangıç 3 Gün', split:'full_body',    days_per_week:3, experience_level:'beginner',     equipment:'bw',   weeks:4, description_en:'Build the habit with zero equipment. Push-up, squat, hinge, core progressions.',                    description_tr:'Sıfır ekipmanla alışkanlık oluştur. Şınav, squat, menteşe ve karın ilerleme serisi.' },
  { id:'fb_3day_beginner',      name_en:'Full Body 3-Day Beginner',        name_tr:'Tüm Vücut 3 Gün Başlangıç',      split:'full_body',    days_per_week:3, experience_level:'beginner',     equipment:'gym',  weeks:4, description_en:'Squat, bench, row, OHP and deadlift fundamentals. 3 days, full body every session.',               description_tr:'Squat, bench press, kürek, OHP ve deadlift temelleri. 3 gün, her seans tüm vücut.' },
  { id:'ul_4day_beginner',      name_en:'Upper/Lower 4-Day Beginner',      name_tr:'Üst/Alt 4 Gün Başlangıç',        split:'upper_lower',  days_per_week:4, experience_level:'beginner',     equipment:'gym',  weeks:4, description_en:'Classic 4-day upper/lower split with A/B variants. Balanced volume for new lifters.',                description_tr:'A/B varyantlı klasik 4 günlük üst/alt ayrımı. Başlangıç için dengeli hacim.' },
  { id:'ul_4day_intermediate',  name_en:'Upper/Lower 4-Day Intermediate',  name_tr:'Üst/Alt 4 Gün Orta Seviye',      split:'upper_lower',  days_per_week:4, experience_level:'intermediate', equipment:'gym',  weeks:4, description_en:'Higher volume with top sets and back-off sets. For athletes with 1+ year of consistent training.',  description_tr:'Top set ve geri çekim setleriyle daha yüksek hacim. 1+ yıl deneyimliler için.' },
  { id:'ppl_3day_beginner',     name_en:'Push/Pull/Legs 3-Day',            name_tr:'İtiş/Çekiş/Bacak 3 Gün',        split:'ppl',          days_per_week:3, experience_level:'beginner',     equipment:'gym',  weeks:4, description_en:'Push, Pull, Legs on 3 days — one rotation per week.',                                             description_tr:'Haftada 3 gün İtiş, Çekiş, Bacak. Kas gelişimi için sade ve etkili.' },
  { id:'ppl_6day_intermediate', name_en:'Push/Pull/Legs 6-Day',            name_tr:'İtiş/Çekiş/Bacak 6 Gün',        split:'ppl',          days_per_week:6, experience_level:'intermediate', equipment:'gym',  weeks:4, description_en:'Two full PPL rotations per week. High frequency hypertrophy.',                                      description_tr:'Haftada iki tam İtiş/Çekiş/Bacak turu. Orta seviye için yüksek frekans hipertrofi.' },
  { id:'home_db_3day',          name_en:'Home Dumbbell 3-Day',             name_tr:'Evde Dumbbell 3 Gün',            split:'full_body',    days_per_week:3, experience_level:'beginner',     equipment:'home', weeks:4, description_en:'Full body training with dumbbells and bands only. No gym required.',                               description_tr:'Sadece dumbbell ve direnç bandıyla tüm vücut antrenmanı. Spor salonu gerekmez.' },
  { id:'home_db_4day',          name_en:'Home Dumbbell 4-Day',             name_tr:'Evde Dumbbell 4 Gün',            split:'upper_lower',  days_per_week:4, experience_level:'intermediate', equipment:'home', weeks:4, description_en:'Upper/lower split using dumbbells and bands.',                                                     description_tr:'Dumbbell ve bantla üst/alt ayrımı. 3 günlük ev programından bir adım yukarı.' },
  { id:'recomp_4day',           name_en:'Recomp 4-Day',                    name_tr:'Rekomp 4 Gün',                   split:'upper_lower',  days_per_week:4, experience_level:'beginner',     equipment:'gym',  weeks:4, description_en:'Accessible volume for fat-loss with muscle retention.',                                            description_tr:'Yağ yakarken kas koruma için uygun hacim. Düşük seans hacmi, yüksek frekans.' },
]

// ── Exercise seed ─────────────────────────────────────────────────────────────
export const SEED_EXERCISES = [
  { id:'bb_back_squat',     name_en:'Barbell Back Squat',      name_tr:'Barbell Arka Squat',      pattern:'squat',  primary_muscle:'quads',      secondary_muscles:['glutes','hamstrings','core'], equipment:'bb', is_compound:true,  cues_en:'Bar on traps, chest up, descend until thighs parallel, drive through heels.', cues_tr:'Bar omuzda, göğüs yukarı, uyluklar paralele inin, topuklardan itin.' },
  { id:'bb_deadlift',       name_en:'Barbell Deadlift',        name_tr:'Barbell Deadlift',         pattern:'hinge',  primary_muscle:'hamstrings', secondary_muscles:['glutes','back','core'],        equipment:'bb', is_compound:true,  cues_en:'Bar over mid-foot, hinge at hips, neutral spine, push floor away.',           cues_tr:'Bar ayak ortasında, kalçadan menteşelen, nötr omurga, zemini it.' },
  { id:'bb_bench_press',    name_en:'Barbell Bench Press',     name_tr:'Barbell Bench Press',      pattern:'push_h', primary_muscle:'chest',      secondary_muscles:['triceps','delts'],             equipment:'bb', is_compound:true,  cues_en:'Retract scapula, bar to lower chest, press to lockout.',                     cues_tr:'Kürek kemiklerini geri çek, bar alt göğse, kilitlenmeye kadar it.' },
  { id:'bb_ohp',            name_en:'Barbell Overhead Press',  name_tr:'Barbell Baş Üstü Press',   pattern:'push_v', primary_muscle:'delts',      secondary_muscles:['triceps','core'],              equipment:'bb', is_compound:true,  cues_en:'Bar at upper chest, press overhead, squeeze glutes for stability.',           cues_tr:'Bar üst göğüste, baş üstüne it, kalçaları sıkarak stabilize et.' },
  { id:'bb_row',            name_en:'Barbell Row',             name_tr:'Barbell Kürek Çekme',      pattern:'pull_h', primary_muscle:'back',       secondary_muscles:['biceps','hamstrings'],          equipment:'bb', is_compound:true,  cues_en:'Hip hinge 45°, pull bar to lower chest, squeeze lats at top.',               cues_tr:'45° kalça menteşesi, barı alt göğse çek, üstte lat\'ı sık.' },
  { id:'bb_rdl',            name_en:'Romanian Deadlift',       name_tr:'Rumen Deadlift',           pattern:'hinge',  primary_muscle:'hamstrings', secondary_muscles:['glutes'],                      equipment:'bb', is_compound:true,  cues_en:'Soft knees, push hips back, feel hamstring stretch, drive hips forward.',    cues_tr:'Hafif diz bükümü, kalçaları geri it, hamstring gerimini hisset, ileri it.' },
  { id:'bb_front_squat',    name_en:'Barbell Front Squat',     name_tr:'Barbell Ön Squat',         pattern:'squat',  primary_muscle:'quads',      secondary_muscles:['core','glutes'],               equipment:'bb', is_compound:true,  cues_en:'Bar on front deltoids, elbows high, upright torso, deep squat.',             cues_tr:'Bar ön deltoidlerde, dirsekler yukarı, dik gövde, derin squat.' },
  { id:'db_goblet_squat',   name_en:'Goblet Squat',            name_tr:'Kupa Squat',               pattern:'squat',  primary_muscle:'quads',      secondary_muscles:['glutes','core'],               equipment:'db', is_compound:true,  cues_en:'Hold DB at chest, feet shoulder-width, descend to depth.',                   cues_tr:'DB\'yi göğüste tut, ayaklar omuz genişliğinde, derine in.' },
  { id:'db_rdl',            name_en:'DB Romanian Deadlift',    name_tr:'DB Rumen Deadlift',        pattern:'hinge',  primary_muscle:'hamstrings', secondary_muscles:['glutes'],                      equipment:'db', is_compound:false, cues_en:'DBs in front of thighs, hinge at hips, feel hamstring stretch.',             cues_tr:'DB\'ler uyluğun önünde, kalçadan menteşelen, hamstring gerimini hisset.' },
  { id:'db_bench_press',    name_en:'DB Bench Press',          name_tr:'Dumbbell Bench Press',     pattern:'push_h', primary_muscle:'chest',      secondary_muscles:['triceps','delts'],             equipment:'db', is_compound:true,  cues_en:'DBs at chest height, press up and in, control descent.',                    cues_tr:'DB\'ler göğüs hizasında, yukarı ve içe doğru it, iniş kontrollü.' },
  { id:'db_incline_press',  name_en:'DB Incline Press',        name_tr:'Eğik Dumbbell Press',      pattern:'push_h', primary_muscle:'chest',      secondary_muscles:['delts','triceps'],             equipment:'db', is_compound:false, cues_en:'30–45° incline, press DBs up, slight arc inward at top.',                   cues_tr:'30–45° eğim, DB\'leri it, üstte hafif içe kavis.' },
  { id:'db_ohp',            name_en:'DB Shoulder Press',       name_tr:'Dumbbell Omuz Press',      pattern:'push_v', primary_muscle:'delts',      secondary_muscles:['triceps'],                     equipment:'db', is_compound:false, cues_en:'DBs at ear level, press overhead.',                                          cues_tr:'DB\'ler kulak hizasında, baş üstüne it.' },
  { id:'db_row',            name_en:'DB Single-Arm Row',       name_tr:'Tek Kol Dumbbell Kürek',   pattern:'pull_h', primary_muscle:'back',       secondary_muscles:['biceps'],                      equipment:'db', is_compound:false, cues_en:'Brace on bench, pull DB to hip, keep elbow close.',                          cues_tr:'Bankaya dayan, DB\'yi kalçaya çek, dirseği yakın tut.' },
  { id:'db_lunge',          name_en:'DB Reverse Lunge',        name_tr:'DB Geri Hamle',            pattern:'squat',  primary_muscle:'quads',      secondary_muscles:['glutes','hamstrings'],          equipment:'db', is_compound:true,  cues_en:'Step back, lower back knee toward floor, push through front heel.',          cues_tr:'Geri adım, arka dizi zemine doğru indir, ön topuktan it.' },
  { id:'db_lateral_raise',  name_en:'DB Lateral Raise',        name_tr:'Dumbbell Yan Kaldırma',    pattern:'iso',    primary_muscle:'delts',      secondary_muscles:[],                              equipment:'db', is_compound:false, cues_en:'Raise DBs to shoulder height, control descent.',                             cues_tr:'DB\'leri omuz hizasına kaldır, kontrollü in.' },
  { id:'db_curl',           name_en:'DB Bicep Curl',           name_tr:'Dumbbell Biseps Curl',     pattern:'pull_v', primary_muscle:'biceps',     secondary_muscles:[],                              equipment:'db', is_compound:false, cues_en:'Supinate at top, keep elbows fixed at sides.',                               cues_tr:'Üstte supinasyon, dirsekleri yanda sabit tut.' },
  { id:'db_tricep_ext',     name_en:'DB Overhead Tricep Ext',  name_tr:'DB Triseps Uzatma',        pattern:'push_v', primary_muscle:'triceps',    secondary_muscles:[],                              equipment:'db', is_compound:false, cues_en:'Hold one DB overhead, lower behind head, extend at top.',                   cues_tr:'DB\'yi baş üstünde tut, enseye indir, tepede uzat.' },
  { id:'db_calf_raise',     name_en:'DB Calf Raise',           name_tr:'Dumbbell Baldır Kaldırma', pattern:'iso',    primary_muscle:'calves',     secondary_muscles:[],                              equipment:'db', is_compound:false, cues_en:'Rise on toes, squeeze calves at top.',                                       cues_tr:'Parmak uçlarına yüksEl, üstte baldırları sık.' },
  { id:'bw_pushup',         name_en:'Push-Up',                 name_tr:'Şınav',                    pattern:'push_h', primary_muscle:'chest',      secondary_muscles:['triceps','core'],              equipment:'bw', is_compound:true,  cues_en:'Plank position, lower until chest near floor, full lockout.',               cues_tr:'Plank pozisyonu, göğüs zemine yaklaşana kadar in, tam kilit.' },
  { id:'bw_incline_push',   name_en:'Incline Push-Up',         name_tr:'Eğimli Şınav',             pattern:'push_h', primary_muscle:'chest',      secondary_muscles:['triceps'],                     equipment:'bw', is_compound:false, cues_en:'Hands on elevated surface. Good beginner entry.',                            cues_tr:'Eller yükseltilmiş yüzeyde. Başlangıç için iyi.' },
  { id:'bw_dip',            name_en:'Parallel Bar Dip',        name_tr:'Paralel Bar Dip',          pattern:'push_v', primary_muscle:'triceps',    secondary_muscles:['chest','delts'],               equipment:'bw', is_compound:true,  cues_en:'Lean forward for chest emphasis, stay upright for triceps.',                cues_tr:'Göğüs vurgusu için öne eğil, triseps için dik dur.' },
  { id:'bw_pullup',         name_en:'Pull-Up',                 name_tr:'Barfiks',                  pattern:'pull_v', primary_muscle:'back',       secondary_muscles:['biceps'],                      equipment:'bw', is_compound:true,  cues_en:'Dead hang, pull chest to bar, full ROM.',                                   cues_tr:'Ölü asılış, göğsü bara çek, tam hareket açıklığı.' },
  { id:'bw_chin_up',        name_en:'Chin-Up',                 name_tr:'Ters Barfiks',             pattern:'pull_v', primary_muscle:'biceps',     secondary_muscles:['back'],                        equipment:'bw', is_compound:true,  cues_en:'Underhand grip, pull chin over bar.',                                        cues_tr:'Ters tutuş, çeneyi barın üstüne çek.' },
  { id:'bw_bodyweight_sq',  name_en:'Bodyweight Squat',        name_tr:'Vücut Ağırlığı Squat',     pattern:'squat',  primary_muscle:'quads',      secondary_muscles:['glutes'],                      equipment:'bw', is_compound:true,  cues_en:'Feet shoulder-width, descend to depth, knees track toes.',                  cues_tr:'Ayaklar omuz genişliğinde, derine in.' },
  { id:'bw_glute_bridge',   name_en:'Glute Bridge',            name_tr:'Kalça Köprüsü',            pattern:'hinge',  primary_muscle:'glutes',     secondary_muscles:['hamstrings'],                  equipment:'bw', is_compound:false, cues_en:'Lie on back, drive hips up, squeeze glutes at top.',                         cues_tr:'Sırt üstü yat, kalçaları kaldır, üstte sık.' },
  { id:'bw_hip_thrust',     name_en:'Hip Thrust (BW)',         name_tr:'Kalça İtişi (VK)',         pattern:'hinge',  primary_muscle:'glutes',     secondary_muscles:['hamstrings'],                  equipment:'bw', is_compound:false, cues_en:'Upper back on bench, hinge hips up, full extension at top.',                cues_tr:'Üst sırt bankada, kalçaları kaldır, tepede tam uzatma.' },
  { id:'bw_plank',          name_en:'Plank',                   name_tr:'Plank',                    pattern:'core',   primary_muscle:'core',       secondary_muscles:[],                              equipment:'bw', is_compound:false, cues_en:'Forearms on ground, body straight, don\'t let hips sag.',                  cues_tr:'Kollar yerde, vücut düz, kalçaların düşmesine izin verme.' },
  { id:'bw_dead_bug',       name_en:'Dead Bug',                name_tr:'Ölü Böcek',                pattern:'core',   primary_muscle:'core',       secondary_muscles:[],                              equipment:'bw', is_compound:false, cues_en:'Lie on back, extend opposite arm/leg, keep lower back flat.',               cues_tr:'Sırt üstü yat, karşıt kol/bacak uzat, beli yerde tut.' },
  { id:'bw_nordic_curl',    name_en:'Nordic Curl',             name_tr:'Nordik Curl',              pattern:'hinge',  primary_muscle:'hamstrings', secondary_muscles:[],                              equipment:'bw', is_compound:true,  cues_en:'Kneel, partner holds ankles, lower slowly.',                                cues_tr:'Diz çök, partner ayak bileklerini tutsun, yavaşça in.' },
  { id:'machine_leg_press', name_en:'Leg Press',               name_tr:'Bacak Presi',              pattern:'squat',  primary_muscle:'quads',      secondary_muscles:['glutes','hamstrings'],          equipment:'machine', is_compound:true,  cues_en:'Feet hip-width, knees track toes, don\'t lock out fully.', cues_tr:'Ayaklar kalça genişliğinde, dizler parmak ucunu takip etsin.' },
  { id:'machine_leg_curl',  name_en:'Lying Leg Curl',          name_tr:'Yatay Bacak Curl',         pattern:'hinge',  primary_muscle:'hamstrings', secondary_muscles:[],                              equipment:'machine', is_compound:false, cues_en:'Curl pad toward glutes, controlled extension.',             cues_tr:'Pedi kalçalara doğru kıv, kontrollü uzatma.' },
  { id:'machine_leg_ext',   name_en:'Leg Extension',           name_tr:'Bacak Uzatma',             pattern:'iso',    primary_muscle:'quads',      secondary_muscles:[],                              equipment:'machine', is_compound:false, cues_en:'Full extension at top, slow eccentric.',                    cues_tr:'Tepede tam uzatma, yavaş eksantrik.' },
  { id:'machine_cable_row', name_en:'Seated Cable Row',        name_tr:'Oturarak Kablo Kürek',     pattern:'pull_h', primary_muscle:'back',       secondary_muscles:['biceps'],                      equipment:'cable', is_compound:false, cues_en:'Pull to navel, elbows back, squeeze lats.',                 cues_tr:'Göbeğe çek, dirsekler geri, lat\'ı sık.' },
  { id:'machine_lat_pulldown', name_en:'Lat Pulldown',         name_tr:'Lat Pulldown',             pattern:'pull_v', primary_muscle:'back',       secondary_muscles:['biceps'],                      equipment:'cable', is_compound:false, cues_en:'Pull to upper chest, slight lean back, full stretch at top.', cues_tr:'Üst göğse çek, hafif geriye eğil, üstte tam gerim.' },
  { id:'machine_cable_fly', name_en:'Cable Crossover Fly',     name_tr:'Kablo Crossover',          pattern:'push_h', primary_muscle:'chest',      secondary_muscles:[],                              equipment:'cable', is_compound:false, cues_en:'Squeeze chest at bottom of arc.',                           cues_tr:'Yayın altında göğsü sık.' },
  { id:'machine_facepull',  name_en:'Face Pull',               name_tr:'Yüz Çekme',                pattern:'pull_h', primary_muscle:'delts',      secondary_muscles:['back'],                        equipment:'cable', is_compound:false, cues_en:'Pull to forehead, elbows flare, external rotation.',        cues_tr:'Alna çek, dirsekler açılsın, dış rotasyon.' },
  { id:'machine_pushdown',  name_en:'Tricep Pushdown',         name_tr:'Triseps Baskısı',          pattern:'push_v', primary_muscle:'triceps',    secondary_muscles:[],                              equipment:'cable', is_compound:false, cues_en:'Elbows fixed, extend arms fully, control return.',          cues_tr:'Dirsekler sabit, kolları tam uzat, kontrollü dön.' },
  { id:'machine_curl_cable', name_en:'Cable Curl',             name_tr:'Kablo Biseps Curl',        pattern:'pull_v', primary_muscle:'biceps',     secondary_muscles:[],                              equipment:'cable', is_compound:false, cues_en:'Curl to chin level, no swinging.',                          cues_tr:'Çene seviyesine kadar kaldır, sallanma.' },
  { id:'band_pull_apart',   name_en:'Band Pull-Apart',         name_tr:'Bant Yayma',               pattern:'pull_h', primary_muscle:'delts',      secondary_muscles:['back'],                        equipment:'band', is_compound:false, cues_en:'Arms straight, pull band to chest width, squeeze rear delts.', cues_tr:'Kollar düz, bandı göğüs genişliğine aç, arka deltoidleri sık.' },
  { id:'band_squat',        name_en:'Band Squat',              name_tr:'Bant Squat',               pattern:'squat',  primary_muscle:'quads',      secondary_muscles:['glutes'],                      equipment:'band', is_compound:true,  cues_en:'Band under feet, handles at shoulder level.',               cues_tr:'Bant ayakların altında, kollar omuz hizasında.' },
  { id:'band_row',          name_en:'Band Seated Row',         name_tr:'Bant Oturarak Kürek',      pattern:'pull_h', primary_muscle:'back',       secondary_muscles:['biceps'],                      equipment:'band', is_compound:false, cues_en:'Wrap band around feet, pull to navel.',                     cues_tr:'Bandı ayakların etrafına sar, göbeğe çek.' },
]

export default function GeneralFitness({ lang = 'en' }) {
  const t = (en, tr) => lang === 'tr' ? tr : en

  const [innerTab, setInnerTab]         = useLocalStorage('sporeus-gf-tab', 'today')
  const [onboarded, setOnboarded]       = useLocalStorage('sporeus-gf-onboarded', false)
  const [activeProgram, setActiveProgram] = useLocalStorage('sporeus-gf-program', null)
  const [sessions, setSessions]         = useLocalStorage('sporeus-gf-sessions', [])
  const [showLogger, setShowLogger]     = useState(false)

  const activeTemplate = STATIC_TEMPLATES.find(t => t.id === activeProgram?.templateId) ?? null
  const templateDayCount = activeTemplate?.days_per_week ?? 0

  function handleOnboardingComplete(data) {
    setActiveProgram({
      templateId:         data.templateId,
      reference_date:     data.reference_date,
      next_day_index:     0,
      sessions_completed: 0,
      last_session_date:  null,
    })
    setOnboarded(true)
    setInnerTab('today')
  }

  function handleSaveSession(session) {
    const today = new Date().toISOString().slice(0, 10)
    const entry = {
      ...session,
      id:           crypto.randomUUID?.() ?? Date.now().toString(),
      session_date: today,
    }
    setSessions(prev => [...prev, entry])

    // Advance rotation pointer
    if (activeProgram) {
      const advanced = advanceRotation({ ...activeProgram, template_days_count: templateDayCount })
      setActiveProgram(prev => ({
        ...prev,
        next_day_index:     advanced.next_day_index,
        sessions_completed: advanced.sessions_completed,
        last_session_date:  today,
      }))
    }

    setShowLogger(false)
    setInnerTab('today')
  }

  function handleSelectTemplate(tmpl) {
    setActiveProgram(prev => ({
      ...prev,
      templateId:     tmpl.id,
      next_day_index: 0,
    }))
  }

  if (!onboarded) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ ...S.mono, fontSize: 14, color: '#ff6600', letterSpacing: '0.12em', padding: '24px 16px 0' }}>
          {t('GENERAL FITNESS', 'GENEL KONDİSYON')}
        </div>
        <div style={{ ...S.mono, fontSize: 10, color: '#888', padding: '4px 16px 16px', letterSpacing: '0.06em' }}>
          {t('Set up your program in 3 steps.', '3 adımda programını oluştur.')}
        </div>
        <OnboardingWizard lang={lang} onComplete={handleOnboardingComplete} />
      </div>
    )
  }

  return (
    <div>
      {/* Inner tab bar */}
      <div role="tablist" style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto' }}>
        {INNER_TABS.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={innerTab === tab.id && !showLogger}
            style={{ ...S.mono, fontSize: 10, padding: '6px 12px', border: `1px solid ${innerTab === tab.id && !showLogger ? '#ff6600' : 'var(--border)'}`, background: innerTab === tab.id && !showLogger ? '#ff660022' : 'transparent', color: innerTab === tab.id && !showLogger ? '#ff6600' : 'var(--muted)', borderRadius: 3, cursor: 'pointer', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}
            onClick={() => { setInnerTab(tab.id); setShowLogger(false) }}
          >
            {lang === 'tr' ? tab.tr : tab.en}
          </button>
        ))}
        <button
          style={{ ...S.mono, fontSize: 10, padding: '6px 10px', border: '1px solid var(--border)', background: 'transparent', color: '#555', borderRadius: 3, cursor: 'pointer', marginLeft: 'auto' }}
          onClick={() => { setOnboarded(false); setActiveProgram(null) }}
          title={t('Reset program setup', 'Program kurulumunu sıfırla')}
        >⚙</button>
      </div>

      <ErrorBoundary>
        <Suspense fallback={null}>

          {/* Today tab */}
          {innerTab === 'today' && !showLogger && (
            <GeneralDashboard
              sessions={sessions}
              activeProgram={activeProgram}
              activeTemplate={activeTemplate}
              lang={lang}
              onLogSession={() => setShowLogger(true)}
            />
          )}

          {/* Log session overlay */}
          {showLogger && (
            <div>
              <button onClick={() => setShowLogger(false)} style={{ ...S.mono, fontSize: 10, marginBottom: 12, padding: '4px 10px', border: '1px solid var(--border)', background: 'transparent', color: '#888', borderRadius: 3, cursor: 'pointer' }}>
                ← {t('Back', 'Geri')}
              </button>
              <SessionLogger
                exercises={SEED_EXERCISES}
                history={{}}
                lang={lang}
                onSave={handleSaveSession}
              />
            </div>
          )}

          {/* Log tab */}
          {innerTab === 'log' && !showLogger && (
            <SessionLogger
              exercises={SEED_EXERCISES}
              history={{}}
              lang={lang}
              onSave={handleSaveSession}
            />
          )}

          {/* Program tab */}
          {innerTab === 'program' && !showLogger && (
            <div>
              {activeTemplate && (
                <div style={{ marginBottom: 20 }}>
                  <ProgramView
                    template={activeTemplate}
                    templateDays={[]}
                    templateExercises={[]}
                    exercises={SEED_EXERCISES}
                    lang={lang}
                  />
                </div>
              )}
              <ProgramTemplateGallery
                templates={STATIC_TEMPLATES}
                activeId={activeProgram?.templateId ?? null}
                lang={lang}
                onSelect={handleSelectTemplate}
              />
            </div>
          )}

          {/* Insights tab */}
          {innerTab === 'insights' && !showLogger && (
            <GeneralInsights
              sessions={sessions}
              exercises={SEED_EXERCISES}
              lang={lang}
            />
          )}

        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
