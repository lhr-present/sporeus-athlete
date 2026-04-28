// src/lib/athlete/sessionLibrary.js — E90
// Complete training session library: running workouts, strength, drills, preventive.
// Covers every modality a 10K/road runner needs from beginner to advanced.
//
// All running prescriptions are pace-parameterised from VDOT (no hardcoded paces).
// HR ranges computed from maxHR when provided; omitted otherwise.
// Bilingual throughout: EN/TR.
//
// References:
//   Daniels J. (2014). Daniels' Running Formula, 3rd ed. Human Kinetics.
//   Bompa T. & Buzzichelli C. (2015). Periodization Training for Sports.
//   Blagrove R. et al. (2018). Strength training effects on endurance runners. Sports Med 48:51–83.
//   Alfredson H. et al. (1998). Eccentric calf-muscle training. Am J Sports Med 26(3):360–366.
//   Myer G.D. et al. (2004). Neuromuscular training for knee injury prevention. J Strength Cond Res 18.
import { trainingPaces } from '../sport/running.js'

function fmtPace(secPerKm) {
  if (!secPerKm || secPerKm <= 0) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

// Replace {E} {M} {T} {I} {R} placeholders with actual pace strings
function injectPaces(str, paces) {
  if (!str || !paces) return str || ''
  return str.replace(/\{([EMTIR])\}/g, (_, k) => paces[k] || '—')
}

// ── Drill circuits (3 progressive levels) ─────────────────────────────────────
export const DRILL_CIRCUITS = [
  {
    name: 'Beginner Form Drills',
    tr: 'Başlangıç Form Hareketleri',
    durationMin: 12,
    level: 'beginner',
    exercises: [
      { name: 'Ankle circles', tr: 'Ayak bileği çeviri', distance: null, reps: '15 each direction', cue: 'Full range, slow and controlled — ankle mobility base', cueTr: 'Tam hareket açıklığı, yavaş ve kontrollü — ayak bileği hareketliliği temeli' },
      { name: 'Leg swings — forward/back', tr: 'Öne-arkaya bacak sallama', distance: null, reps: '10 each leg', cue: 'Wall for balance; swing loosely to activate hip flexors and hamstrings', cueTr: 'Denge için duvara tutun; kalça fleksörü ve hamstringi aktive etmek için serbest sallama' },
      { name: 'Leg swings — lateral', tr: 'Yana bacak sallama', distance: null, reps: '10 each leg', cue: 'Abductor and adductor mobility; keep upper body still', cueTr: 'Abdüktör ve addüktör hareketliliği; üst vücudu sabit tut' },
      { name: 'High knees — march', tr: 'Yüksek diz yürüyüşü', distance: '2×20m', reps: null, cue: 'Slow march; drive knee to hip height; stay tall with strong arm drive', cueTr: 'Yavaş yürüyüş; dizi kalça yüksekliğine çıkar; dik dur, güçlü kol hareketi' },
      { name: 'Butt kicks — slow', tr: 'Yavaş topuk çekme', distance: '2×20m', reps: null, cue: 'Heel to glute; hamstring activation; keep hips forward', cueTr: 'Topuk kalçaya; hamstring aktivasyonu; kalçaları öne tut' },
      { name: 'A-march', tr: 'A-yürüyüşü', distance: '2×20m', reps: null, cue: 'March rhythm: pick up knee, put foot down directly under hip; arm at 90°', cueTr: 'Yürüyüş ritmi: dizi kaldır, ayağı kalça altına bırak; kol 90°de' },
      { name: 'A-skip', tr: 'A-sekme', distance: '2×30m', reps: null, cue: 'Add elastic skip to A-march; stay on ball of foot; quick ground contact', cueTr: 'A-yürüyüşüne elastik sekme ekle; topağa dur; kısa yer teması' },
      { name: 'Strides ×4', tr: 'Hız açmaları ×4', distance: '4×80m', reps: null, cue: 'Build to ~5K effort over 40m, hold 40m, decelerate; full walk recovery between', cueTr: '40m\'de yavaşça 5K eforu, 40m tut, yavaşla; aralarında tam yürüyüş toparlanması' },
    ],
  },
  {
    name: 'Intermediate Form Drills',
    tr: 'Orta Seviye Form Hareketleri',
    durationMin: 15,
    level: 'intermediate',
    exercises: [
      { name: 'Ankle cycling (paw drill)', tr: 'Ayak bileği döngüsü (pençe hareketi)', distance: '2×30m', reps: null, cue: 'Foot cycles under hip; fast turnover; minimal ground contact; stiff ankle', cueTr: 'Ayak kalça altında döner; hızlı devir; minimal yer teması; sert ayak bileği' },
      { name: 'A-skip', tr: 'A-sekme', distance: '2×30m', reps: null, cue: 'Quick rhythm; knee drives up sharply; arms locked at 90°; land midfoot', cueTr: 'Hızlı ritim; diz keskin yukarı; kollar 90°de sabit; öndamara iniş' },
      { name: 'B-skip', tr: 'B-sekme', distance: '2×30m', reps: null, cue: 'A-skip then extend lower leg forward before pawing back — heel recovery drill', cueTr: 'A-sekme, ardından alt bacağı öne uzat, geri pençele — topuk toparlanma alıştırması' },
      { name: 'Carioca (grapevine)', tr: 'Karioça', distance: '2×30m each direction', reps: null, cue: 'Lateral crossover; hip rotation; quick feet; keep shoulders square', cueTr: 'Yan çapraz adım; kalça rotasyonu; hızlı ayaklar; omuzlar düz' },
      { name: 'Fast high knees', tr: 'Hızlı yüksek diz', distance: '2×30m', reps: null, cue: 'Increase cadence; arms match leg drive; ball of foot contact only', cueTr: 'Kadansı artır; kollar bacakla uyumlu; sadece öndamar teması' },
      { name: 'Bounding', tr: 'Zıplama koşusu', distance: '3×30m', reps: null, cue: 'Exaggerated stride; maximise hang time; powerful push-off; tall posture; ground contact under hip', cueTr: 'Abartılı adım; havada kalma süresini uzat; güçlü itme; dik duruş; yer teması kalça altında' },
      { name: 'Strides ×6', tr: 'Hız açmaları ×6', distance: '6×100m', reps: null, cue: 'Build to 10K race effort; strong arm drive; full walk-back recovery', cueTr: '10K yarış eforu; güçlü kol hareketi; geri yürüyerek tam toparlanma' },
    ],
  },
  {
    name: 'Advanced Form Drills',
    tr: 'İleri Seviye Form Hareketleri',
    durationMin: 18,
    level: 'advanced',
    exercises: [
      { name: 'A-skip → B-skip complex', tr: 'A-sekme → B-sekme karmaşık seti', distance: '2×30m', reps: null, cue: 'Seamless A→B transition mid-distance; maintain rhythm; arms stay at 90°', cueTr: 'Mesafenin ortasında akıcı A→B geçişi; ritmi koru; kollar 90°de' },
      { name: 'Fast leg — paw-back drill', tr: 'Pençe geri çekme hareketi', distance: '2×30m', reps: null, cue: 'Single leg cycles rapidly in backward paw motion under hip; hip extension critical; other leg supports', cueTr: 'Tek bacak kalça altında hızlıca pençe hareketi; kalça ekstansiyonu kritik; diğer bacak destek' },
      { name: 'Bounding — triple extension', tr: 'Zıplama — üçlü ekstansiyon', distance: '3×40m', reps: null, cue: 'Full ankle-knee-hip extension on each bound; maximise elastic return; soft midfoot landing', cueTr: 'Her zıplamada tam bilek-diz-kalça ekstansiyonu; elastik geri dönüşü maksimize et; yumuşak öndamar iniş' },
      { name: 'Uphill sprints', tr: 'Yokuş yukarı sprint', distance: null, reps: '6×15s at 6–8% grade', cue: 'Max effort; drive arms and knees; walk/jog down full recovery; builds power and running economy', cueTr: '%6–8 eğimde maksimum efor; kol ve dizi sürücü; aşağı yürüyerek tam toparlanma; güç ve koşu ekonomisi geliştirir' },
      { name: 'Race-pace strides', tr: 'Yarış temposu hız açmaları', distance: '6–8×100–150m', reps: null, cue: 'Hold 10K goal race pace from stride 1; controlled effort not sprinting; feel race rhythm before interval session', cueTr: 'İlk adımdan 10K hedef yarış temposu; sprint değil kontrollü efor; aralıklı antrenman öncesi yarış ritmini hisset' },
    ],
  },
]

// ── Preventive routines (3 focus areas) ───────────────────────────────────────
export const PREVENTIVE_ROUTINES = {
  hip_glute: {
    name: 'Hip & Glute Activation',
    tr: 'Kalça & Gluteus Aktivasyon',
    durationMin: 15,
    focus: 'hip_glute',
    exercises: [
      { name: '90/90 hip stretch', tr: '90/90 kalça germe', sets: 2, reps: '60s each side', notes: 'Front + rear shin both parallel; rotate torso to feel glute / hip flexor alternately', notesTr: 'Ön + arka baldır her ikisi de paralel; gluteus / kalça fleksörü hissedene kadar gövde döndür' },
      { name: 'Pigeon pose', tr: 'Güvercin pozu', sets: 2, reps: '60s each side', notes: 'Hip external rotation + flexion; let gravity deepen the stretch; breathe slowly', notesTr: 'Kalça dış rotasyonu + fleksiyonu; yerçekiminin germeyi derinleştirmesine izin ver; yavaş nefes' },
      { name: 'IT band lateral lean', tr: 'IT bandı yan eğilme', sets: 2, reps: '30s each side', notes: 'Cross feet; lean away from standing leg; feel outer thigh and TFL', notesTr: 'Ayakları çapraz; ayakta durduğun bacaktan uzağa eğil; dış uyluk ve TFL\'de hisset' },
      { name: 'Clamshell with band', tr: 'Kalça abdüktör — bant', sets: 3, reps: '15 each side', notes: 'Lie on side, light band above knees; rotate top knee up; glute med activation — key anti-knee-collapse muscle', notesTr: 'Yanda uzan, hafif bant dizlerin üstünde; üst dizi döndür; gluteus medius aktivasyonu — diz çökmesine karşı anahtar kas' },
      { name: 'Monster walk', tr: 'Canavar yürüyüşü', sets: 2, reps: '15 steps each direction', notes: 'Band above knees; low squat stance; lateral + forward walking; hip abductors and external rotators', notesTr: 'Bant dizlerin üstünde; alçak çömelme duruşu; yana + öne yürüyüş; kalça abdüktörleri ve dış rotatorler' },
      { name: 'Hip flexor lunge stretch', tr: 'Kalça fleksörü germe', sets: 2, reps: '30s each side', notes: 'Back knee on ground; tuck pelvis posteriorly; reach same-side arm up; feel anterior hip', notesTr: 'Arka diz yerde; pelvisi arkaya tilt; aynı taraf kolu yukarı uzat; ön kalçada hisset' },
      { name: 'Single-leg balance', tr: 'Tek bacak denge', sets: 3, reps: '30s each leg', notes: 'Soft knee; eyes closed for progression; engage glute to prevent hip drop — direct proprioception transfer to running gait', notesTr: 'Hafif diz büküm; ilerleme için gözlerini kapat; kalça düşmesini önlemek için gluteusu aktive et' },
    ],
  },
  calf_achilles: {
    name: 'Calf & Achilles Care',
    tr: 'Baldır & Aşil Tendon Bakımı',
    durationMin: 15,
    focus: 'calf_achilles',
    exercises: [
      { name: 'Standing calf stretch — straight knee', tr: 'Dik diz baldır germe', sets: 2, reps: '30s each', notes: 'Hands on wall; heel on ground; targets gastrocnemius', notesTr: 'Duvara el; topuk yerde; gastrocnemius hedefler' },
      { name: 'Standing calf stretch — bent knee', tr: 'Bükümlü diz baldır germe', sets: 2, reps: '30s each', notes: 'Slight bend targets soleus and Achilles tendon insertion specifically', notesTr: 'Hafif büküm soleus ve Achilles yapışma noktasını spesifik olarak hedefler' },
      { name: 'Eccentric calf raise off step', tr: 'Basamaktan eksantrik baldır kaldırma', sets: 3, reps: '15 each leg', notes: 'Alfredson 1998 protocol: raise bilaterally, lower single-leg in 3s; gold standard for Achilles tendinopathy prevention and treatment', notesTr: 'Alfredson 1998 protokolü: iki bacakla kaldır, tek bacakla 3 saniyede indir; Aşil tendinopatisi önleme ve tedavisinde altın standart' },
      { name: 'Tibialis anterior raise', tr: 'Tibialis ön kaldırma', sets: 3, reps: '20', notes: 'Heels on ground; lift toes maximally; shin splints prevention; anterior compartment strengthening', notesTr: 'Topuklar yerde; parmak uçlarını maksimumda kaldır; shin splints önleme; ön kompartman güçlendirme' },
      { name: 'Ankle circles', tr: 'Ayak bileği çeviri', sets: 2, reps: '15 each direction each ankle', notes: 'Full circumduction; maintains ankle ROM and tendon health under load', notesTr: 'Tam döngü hareketi; yük altında ayak bileği hareket açıklığını ve tendon sağlığını korur' },
      { name: 'Foam roll calves', tr: 'Köpük rulosu ile baldır', sets: 1, reps: '60s each leg', notes: 'Slow roll; pause 5s on tender spots; cross top leg for deeper pressure', notesTr: 'Yavaş rulo; hassas noktalarda 5 saniye dur; daha derin baskı için üst bacağı çapraz koy' },
      { name: 'Plantar fascia stretch', tr: 'Plantar fasya germe', sets: 2, reps: '30s each', notes: 'Seated: pull toes toward shin; or stand toes on step edge; prevents plantar fasciitis', notesTr: 'Oturarak: parmakları baldıra doğru çek; veya basamak kenarında parmak uçlarında dur; plantar fasiit önler' },
    ],
  },
  full_mobility: {
    name: 'Full Body Mobility',
    tr: 'Tüm Vücut Esneklik',
    durationMin: 12,
    focus: 'full_mobility',
    exercises: [
      { name: 'Cat-cow', tr: 'Kedi-inek', sets: 1, reps: '10 cycles', notes: 'Synchronise breath with movement; full spinal flexion then extension', notesTr: 'Hareketi nefesle senkronize et; tam omurga fleksiyonu ardından ekstansiyon' },
      { name: 'Thread the needle', tr: 'İğneden iplik geçirme', sets: 1, reps: '8 each side', notes: 'Quadruped; rotate thoracic spine; keep hips square — unlocks running posture', notesTr: 'Dört ayakta; torasik omurgayı döndür; kalçaları düz tut — koşu duruşunu açar' },
      { name: 'Supine hamstring stretch', tr: 'Sırtüstü hamstring germe', sets: 2, reps: '30s each leg', notes: 'Band or towel; keep pelvis flat; soft knee — neural and muscular component', notesTr: 'Bant veya havlu; pelvis düz; hafif diz büküm — nöral ve kas bileşeni' },
      { name: 'Hip flexor lunge', tr: 'Kalça fleksörü germe', sets: 2, reps: '30s each', notes: 'Low lunge; posterior pelvic tilt; feel anterior hip — critical for stride length', notesTr: 'Alçak hamle; posterior pelvik tilt; ön kalçada hisset — adım uzunluğu için kritik' },
      { name: 'Figure-4 / pigeon (seated)', tr: 'Şekil-4 / güvercin (oturarak)', sets: 2, reps: '30s each', notes: 'Sit tall; cross ankle over opposite knee; fold forward gently for glute stretch', notesTr: 'Dik otur; bileği karşı dizi üzerine koy; gluteus için hafifçe öne eğil' },
      { name: 'Quadruped hip circle', tr: 'Dört ayakta kalça çeviri', sets: 1, reps: '10 each direction each leg', notes: 'Large slow circles; hip joint mobilisation — maintains femoral head health', notesTr: 'Geniş yavaş çemberler; kalça eklem mobilizasyonu — femoral baş sağlığını korur' },
      { name: 'Thoracic foam roll', tr: 'Torasik köpük rulosu', sets: 1, reps: '60s', notes: 'Arms crossed over chest; roll upper/mid back; pause on stiff segments; improves arm swing', notesTr: 'Kollar göğüste çapraz; üst/orta sırt rulo; sert noktalarda dur; kol hareketini iyileştirir' },
      { name: 'Calf + Achilles stretch', tr: 'Baldır + Aşil germe', sets: 2, reps: '25s straight + 25s bent knee', notes: 'Both gastrocnemius and soleus in one sequence', notesTr: 'Tek bir dizide hem gastrocnemius hem soleus' },
    ],
  },
}

// ── Strength workouts (6 progressive templates) ───────────────────────────────
export const STRENGTH_WORKOUTS = {
  foundation_lower: {
    name: 'Foundation Strength — Lower Body',
    tr: 'Temel Kuvvet — Alt Vücut',
    durationMin: 40,
    category: 'foundation',
    exercises: [
      { name: 'Goblet squat', tr: 'Kupa çömelme', sets: 3, reps: '12', notes: 'Bodyweight or light KB; full depth; knees track toes; builds squat pattern safely', notesTr: 'Vücut ağırlığı veya hafif KB; tam derinlik; dizler ayak parmaklarını takip eder; squat kalıbını güvenle oluşturur' },
      { name: 'Glute bridge', tr: 'Gluteus köprüsü', sets: 3, reps: '15', notes: 'Drive hips up; squeeze glutes at top for 2s; posterior chain activation for runners', notesTr: 'Kalçaları güçlü kaldır; üstte 2s gluteusu sık; koşucular için arka zincir aktivasyonu' },
      { name: 'Side-lying clamshell', tr: 'İstridye hareketi', sets: 3, reps: '15 each side', notes: 'Light band; feet together; rotate top knee up without rolling hips; glute med — anti-knee-collapse', notesTr: 'Hafif bant; ayaklar bir arada; kalçaları döndürmeden üst dizi çevir; gluteus med — diz çökmesi karşıtı' },
      { name: 'Lateral band walk', tr: 'Yana bant yürüyüşü', sets: 2, reps: '15 steps each direction', notes: 'Band above knees; mini-squat stance; stay low; hip abductors — direct ITBS prevention', notesTr: 'Bant dizlerin üstünde; mini çömelme duruşu; alçak kal; kalça abdüktörleri — ITBS önlemi' },
      { name: 'Step-up', tr: 'Basamak çıkma', sets: 3, reps: '10 each leg', notes: '20–30cm box; drive through heel; full hip extension at top; single-leg confidence builder', notesTr: '20–30cm kutu; topuktan it; üstte tam kalça ekstansiyonu; tek bacak güven inşacısı' },
      { name: 'Standing calf raise (bilateral)', tr: 'Ayakta baldır kaldırma (iki bacak)', sets: 3, reps: '20', notes: 'Full range; 3s slow descent; progress to single-leg over time; Achilles tendon load introduction', notesTr: 'Tam hareket; 3s yavaş iniş; zamanla tek bacağa ilerle; Aşil tendon yükleme girişi' },
      { name: 'Dead bug', tr: 'Ölü böcek', sets: 3, reps: '8 each side', notes: 'Lumbar spine to floor throughout; slow opposite arm + leg extension; core anti-extension', notesTr: 'Bel omurgası boyunca yerde; yavaş karşı kol + bacak uzantısı; core anti-ekstansiyon' },
      { name: 'Wall sit', tr: 'Duvar oturması', sets: 3, reps: '30s', notes: 'Thighs parallel to floor; back flat on wall; isometric quad endurance; easy to regress', notesTr: 'Uyluklar zemine paralel; sırt duvara düz; izometrik kuadriseps dayanıklılığı; kolayca geri alınabilir' },
    ],
  },
  foundation_core: {
    name: 'Foundation Strength — Core & Upper',
    tr: 'Temel Kuvvet — Core & Üst Vücut',
    durationMin: 30,
    category: 'foundation',
    exercises: [
      { name: 'Push-up', tr: 'Şınav', sets: 3, reps: '10', notes: 'Full range; body in straight plank; chest to floor; modify on knees if needed; running posture strength', notesTr: 'Tam hareket; vücut düz tahta; göğüs yere; gerekirse diz üstünde değiştir; koşu duruşu kuvveti' },
      { name: 'Plank', tr: 'Plank', sets: 3, reps: '30s', notes: 'Forearm or hands; neutral spine; no hip hike or sag; breathe normally — core anti-extension fundamental', notesTr: 'Ön kol veya el; nötr omurga; kalça kalkmasın/çöküşmesin; normal nefes — core anti-ekstansiyon temeli' },
      { name: 'Side plank', tr: 'Yan plank', sets: 3, reps: '20s each side', notes: 'Elbow under shoulder; hip fully up; straight body line; glute med fires — lateral stability for single-leg running', notesTr: 'Dirsek omuz altında; kalça tam yukarı; düz vücut hattı; gluteus med çalışır — tek bacak koşu lateral stabilitesi' },
      { name: 'Bird-dog', tr: 'Kuş-köpek', sets: 3, reps: '10 each side', notes: 'Quadruped; opposite arm + leg; keep hips perfectly level; 3s hold at extension; anti-rotation + hip control', notesTr: 'Dört ayakta; karşı kol + bacak; kalçaları mükemmel düz tut; ekstansiyonda 3s tut; anti-rotasyon + kalça kontrolü' },
      { name: 'Pallof press (band)', tr: 'Pallof baskısı (bant)', sets: 3, reps: '10 each side', notes: 'Band at chest; press out fully, hold 2s, return; core anti-rotation — translates directly to running gait', notesTr: 'Göğüste bant; tamamen dışa bas, 2s tut, geri dön; core anti-rotasyon — koşu gaitasına doğrudan transfer' },
      { name: 'Band pull-apart', tr: 'Bant çekme', sets: 3, reps: '15', notes: 'Arms at shoulder height; pull band to chest; scapular retraction + rotator cuff health for running arm swing', notesTr: 'Kollar omuz hizasında; bandı göğse çek; skapular retraksiyon + koşu kol salınımı için rotator manşon sağlığı' },
      { name: 'Single-leg balance reach', tr: 'Tek bacak denge uzanma', sets: 3, reps: '8 each leg', notes: 'Reach in Y / T / W directions; glute med + proprioception; prevent ankle sprains and hip drops in running', notesTr: 'Y / T / W yönlerinde uzanma; gluteus med + propriosepsiyon; koşuda ayak bileği burkulması ve kalça düşmesini önle' },
    ],
  },
  progressive_lower: {
    name: 'Progressive Strength — Lower Body',
    tr: 'İlerleme Kuvvet — Alt Vücut',
    durationMin: 45,
    category: 'progressive',
    exercises: [
      { name: 'Bulgarian split squat', tr: 'Bulgar ayrık çömelme', sets: 3, reps: '10 each leg', notes: 'Rear foot elevated; front foot far for vertical shin; bodyweight→DB→barbell; highest single-leg strength ROI for runners', notesTr: 'Arka ayak yüksekte; dikey tibia için ön ayak uzakta; vücut ağırlığı→DB→barbell; koşucular için en yüksek tek bacak kuvvet ROI' },
      { name: 'Hip thrust', tr: 'Kalça itiş', sets: 3, reps: '12', notes: 'Shoulders on bench; barbell over hips (use pad); drive hips up explosively; 1s peak hold; posterior chain power base', notesTr: 'Omuzlar bankta; bar kalça üstünde (pad kullan); kalçaları patlayıcı kaldır; 1s zirve tutma; posterior zincir güç tabanı' },
      { name: 'Single-leg RDL with DB', tr: 'Tek bacak RDL (dumbbell)', sets: 3, reps: '10 each leg', notes: 'Hinge at hip; flat back; soft standing-leg knee; hamstring length + hip stability — simulates running push-off', notesTr: 'Kalçadan menteşe; düz sırt; yumuşak duran bacak dizi; hamstring uzunluğu + kalça stabilitesi — koşu itişini simüle eder' },
      { name: 'Nordic hamstring curl', tr: 'Nordik hamstring kıvırma', sets: 3, reps: '6–8', notes: 'Eccentric only: partner holds ankles; lower body slowly in 4s; catch with hands if needed — highest evidence exercise for hamstring strain prevention', notesTr: 'Sadece eksantrik: partner bilekleri tutar; vücudu 4 saniyede indir; gerekirse ellerle tut — hamstring gerilmesi önleme için en yüksek kanıtlı egzersiz' },
      { name: 'Single-leg calf raise off step', tr: 'Tek bacak baldır kaldırma — basamaktan', sets: 3, reps: '15 each leg', notes: 'Full range; 3s eccentric descent; Alfredson protocol load for Achilles resilience; most critical for high-mileage runners', notesTr: 'Tam hareket; 3s eksantrik iniş; Aşil dayanıklılığı için Alfredson protokol yükü; yüksek milajlı koşucular için en kritik' },
      { name: 'Lateral step-down', tr: 'Yana basamak inişi', sets: 3, reps: '10 each leg', notes: 'Stand on box; reach opposite heel to floor; control knee alignment; VMO + glute med — patellofemoral pain prevention', notesTr: 'Kutunun üstünde dur; karşı topuğa yere uzan; diz hizasını kontrol et; VMO + gluteus med — patellofemoral ağrı önlemi' },
      { name: 'Copenhagen plank', tr: 'Kopenhag plankı', sets: 3, reps: '20s each side', notes: 'Side plank with top foot on bench; adductor load; highest evidence for groin and adductor strain prevention', notesTr: 'Yan plank, üst ayak bankta; addüktör yükleme; kasık ve addüktör gerilmesi önleme için en yüksek kanıt' },
    ],
  },
  progressive_power: {
    name: 'Progressive Strength — Power & Plyometrics',
    tr: 'İlerleme Kuvvet — Güç & Pliometri',
    durationMin: 35,
    category: 'progressive',
    exercises: [
      { name: 'Box jump', tr: 'Kutu atlaması', sets: 3, reps: '8', notes: '30–40cm box; absorb landing softly in hips/knees; step down (do not jump down); develops rate of force development', notesTr: '30–40cm kutu; kalça/dizlerde yumuşak iniş absorpsiyonu; atlayarak değil adımlayarak in; kuvvet geliştirme hızını artırır' },
      { name: 'Single-leg hop — controlled landing', tr: 'Tek bacak sekme — kontrollü iniş', sets: 3, reps: '8 each leg', notes: 'Hop 1m forward; land same leg; absorb in 2s hold; ACL prehabilitation + single-leg power', notesTr: '1m öne sekme; aynı bacakla in; 2 saniyede absorbe et ve tut; ACL prehabilitasyonu + tek bacak güç' },
      { name: 'Reactive squat jump', tr: 'Reaktif çömelme sıçraması', sets: 3, reps: '6', notes: 'Land → immediately jump: minimise ground contact; reactive strength and elastic energy storage', notesTr: 'İn → hemen zıpla; yer temas süresini minimize et; reaktif kuvvet ve elastik enerji depolama' },
      { name: 'Barbell Romanian deadlift', tr: 'Barbell Romen deadlift', sets: 3, reps: '8', notes: 'Moderate load (60–70% 1RM); hip hinge; flat back; posterior chain strength translates to running economy', notesTr: 'Orta yük (%60–70 1RM); kalça menteşe; düz sırt; posterior zincir kuvveti koşu ekonomisine transfer olur' },
      { name: 'Single-leg deadlift to hop', tr: 'Tek bacak deadlift → sekme', sets: 3, reps: '6 each leg', notes: 'Hinge → stand → immediately hop forward; combines eccentric strength + concentric power + proprioception', notesTr: 'Menteşe → kalk → hemen öne sekme; eksantrik kuvvet + konsantrik güç + propriosepsiyonu birleştirir' },
      { name: 'Triple hop for distance', tr: 'Üç sekme mesafe testi', sets: 3, reps: '3 hops', notes: 'Max distance per hop; measures and trains elastic leg stiffness — correlates with running economy at fast paces', notesTr: 'Sekme başına maksimum mesafe; elastik bacak sertliğini ölçer ve antrenman yapar — hızlı tempoda koşu ekonomisiyle ilişkili' },
    ],
  },
  maintenance_a: {
    name: 'Maintenance Strength A',
    tr: 'Bakım Kuvvet A',
    durationMin: 30,
    category: 'maintenance',
    exercises: [
      { name: 'Trap-bar deadlift (or barbell back squat)', tr: 'Tuzak bar deadlift (veya barbell squat)', sets: 3, reps: '5 — heavy (~87% 1RM)', notes: 'Max strength stimulus preserved at peak training volume; neuromuscular drive for running economy; allow full recovery before race week', notesTr: 'Zirve antrenman hacminde maksimum kuvvet uyarısı korunur; koşu ekonomisi için nöromüsküler sürücü; yarış haftasından önce tam toparlanma' },
      { name: 'Bulgarian split squat', tr: 'Bulgar ayrık çömelme', sets: 2, reps: '8 each leg — moderate', notes: 'Maintain unilateral strength and stability; do not increase load during peak phase', notesTr: 'Tek taraflı kuvvet ve stabilitesi koru; zirve fazında yükü artırma' },
      { name: 'Single-leg eccentric calf raise', tr: 'Tek bacak eksantrik baldır kaldırma', sets: 3, reps: '12 each leg', notes: 'Off step; 4s eccentric; maintains Achilles tendon health through highest weekly mileage', notesTr: 'Basamaktan; 4 saniyelik eksantrik; en yüksek haftalık milajda Aşil tendon sağlığını korur' },
      { name: 'Copenhagen plank', tr: 'Kopenhag plankı', sets: 2, reps: '25s each side', notes: 'Maintain adductor strength; groin injury prevention continues at peak', notesTr: 'Addüktör kuvvetini koru; zirve fazında kasık yaralanması önlemi devam eder' },
      { name: 'Plank with shoulder tap', tr: 'Omuz taplı plank', sets: 2, reps: '10 each side', notes: 'Anti-rotation core; maintain stiffness under high running load', notesTr: 'Anti-rotasyon core; yüksek koşu yükü altında sertliği koru' },
    ],
  },
  maintenance_b: {
    name: 'Maintenance Strength B',
    tr: 'Bakım Kuvvet B',
    durationMin: 25,
    category: 'maintenance',
    exercises: [
      { name: 'Hip thrust', tr: 'Kalça itiş', sets: 3, reps: '12 — moderate load', notes: 'Maintain glute activation and posterior chain power; lower load than build phase', notesTr: 'Gluteus aktivasyonu ve posterior zincir gücünü koru; yapım fazından düşük yük' },
      { name: 'Single-leg RDL', tr: 'Tek bacak RDL', sets: 2, reps: '8 each — light', notes: 'Balance + hamstring maintenance; stay controlled; no PB attempts during peak', notesTr: 'Denge + hamstring bakımı; kontrollü kal; zirve fazında kişisel rekor denemesi yapma' },
      { name: 'Nordic hamstring curl — eccentric', tr: 'Nordik hamstring kıvırma — eksantrik', sets: 2, reps: '5', notes: 'Maintain eccentric hamstring strength; key for high-speed running safety', notesTr: 'Eksantrik hamstring kuvvetini koru; yüksek hızda koşu güvenliği için anahtar' },
      { name: 'Box jump', tr: 'Kutu atlaması', sets: 2, reps: '5', notes: 'Maintain neural drive and power; lower volume than build phase; no fatigue accumulation', notesTr: 'Nöral sürücü ve gücü koru; yapım fazından düşük hacim; yorgunluk birikimi yok' },
      { name: 'Side plank', tr: 'Yan plank', sets: 2, reps: '30s each side', notes: 'Core lateral stability for running form under race-week pressure', notesTr: 'Yarış haftası baskısı altında koşu formu için core lateral stabilitesi' },
    ],
  },
}

// ── Running session templates (pace placeholders resolved at build time) ───────
// zone: 1=recovery, 2=easy/aerobic, 3=marathon, 4=threshold, 5=VO2max/rep
const RUN_SESSIONS = {
  EASY_30:            { type: 'Easy Run 30min',            tr: 'Kolay Koşu 30dk',             durationMin: 30,  paceKey: 'E', zone: 2, rpeLow: 3, rpeHigh: 4, hrPctLow: 0.65, hrPctHigh: 0.79, tss: 25, structure: 'Continuous easy run at {E}/km (conversational pace). HR stays below 79% maxHR throughout. Talk test: you can say a full sentence without gasping.', structureTr: '{E}/km\'de sürekli kolay koşu (sohbet temposu). Nabız boyunca maks nabzın %79\'unun altında. Konuşma testi: nefes kesilmeden tam cümle kurabilmelisin.' },
  EASY_40:            { type: 'Easy Run 40min',            tr: 'Kolay Koşu 40dk',             durationMin: 40,  paceKey: 'E', zone: 2, rpeLow: 3, rpeHigh: 4, hrPctLow: 0.65, hrPctHigh: 0.79, tss: 38, structure: 'Continuous easy run at {E}/km. Allow HR to settle naturally in first 10min; conversational effort throughout. Do NOT push.', structureTr: '{E}/km\'de sürekli kolay koşu. İlk 10 dakikada nabzın doğal oturmasına izin ver; boyunca sohbet eforu. Zorlanma.' },
  EASY_50:            { type: 'Easy Run 50min',            tr: 'Kolay Koşu 50dk',             durationMin: 50,  paceKey: 'E', zone: 2, rpeLow: 3, rpeHigh: 5, hrPctLow: 0.65, hrPctHigh: 0.79, tss: 48, structure: 'Continuous easy run at {E}/km. Last 10min may feel harder as fuel depletes — maintain pace, not effort. Core aerobic base builder.', structureTr: '{E}/km\'de sürekli kolay koşu. Yakıt tükendikçe son 10 dakika daha zor hissedebilir — efor değil tempo koru. Temel aerobik taban inşacısı.' },
  RECOVERY_30:        { type: 'Recovery Run 30min',        tr: 'Toparlanma Koşusu 30dk',      durationMin: 30,  paceKey: 'E', zone: 1, rpeLow: 2, rpeHigh: 3, hrPctLow: 0.60, hrPctHigh: 0.70, tss: 22, structure: 'Ultra-easy recovery run. Slower than {E}/km is perfectly fine. Goal: blood flow, not fitness. HR below 70% maxHR.', structureTr: 'Ultra kolay toparlanma koşusu. {E}/km\'den yavaş tamamen normal. Hedef: kan akışı, fitness değil. Nabız maks nabzın %70\'inin altında.' },
  RECOVERY_40:        { type: 'Recovery Run 40min',        tr: 'Toparlanma Koşusu 40dk',      durationMin: 40,  paceKey: 'E', zone: 1, rpeLow: 2, rpeHigh: 3, hrPctLow: 0.60, hrPctHigh: 0.70, tss: 30, structure: 'Recovery run — slower than {E}/km is correct. No pace target. Feel: you could run forever. Promotes physiological adaptation from preceding hard work.', structureTr: 'Toparlanma koşusu — {E}/km\'den yavaş doğrudur. Tempo hedefi yok. His: sonsuza kadar koşabilirsin. Önceki sert çalışmadan fizyolojik adaptasyonu destekler.' },
  LONG_60_75:         { type: 'Long Run 60–75min',         tr: 'Uzun Koşu 60–75dk',           durationMin: 68,  paceKey: 'E', zone: 2, rpeLow: 4, rpeHigh: 5, hrPctLow: 0.65, hrPctHigh: 0.79, tss: 65, structure: 'Continuous long run at {E}/km. Duration > distance goal. Final 10min should still feel controlled. Fuelling: 1 gel or 500ml sports drink after 45min. Stimulus: fat oxidation, cardiac output.', structureTr: '{E}/km\'de sürekli uzun koşu. Süre hedefi > mesafe hedefi. Son 10 dakika hâlâ kontrollü hissettirmeli. Beslenme: 45 dakika sonra 1 jel veya 500ml spor içeceği. Uyarı: yağ oksidasyonu, kardiyak debi.' },
  LONG_75_90:         { type: 'Long Run 75–90min (progression)', tr: 'Uzun Koşu 75–90dk (progresyon)', durationMin: 83, paceKey: 'M', zone: 3, rpeLow: 4, rpeHigh: 6, hrPctLow: 0.65, hrPctHigh: 0.82, tss: 85, structure: 'Start at {E}/km for first 55–65min. Final 20–25min at M-pace ({M}/km). Fuelling: 1–2 gels, hydrate every 20min. Stimulus: aerobic economy, fat utilisation at marathon effort.', structureTr: 'İlk 55–65 dakika {E}/km\'de başla. Son 20–25 dakika M-tempoda ({M}/km). Beslenme: 1–2 jel, her 20 dakikada hidrasyon. Uyarı: aerobik ekonomi, maraton eforu yağ kullanımı.' },
  LONG_90:            { type: 'Long Run 90min',             tr: 'Uzun Koşu 90dk',              durationMin: 90,  paceKey: 'M', zone: 3, rpeLow: 5, rpeHigh: 7, hrPctLow: 0.65, hrPctHigh: 0.82, tss: 95, structure: 'At {E}/km for 60min; final 25–30min at M-pace ({M}/km). 2 gels + electrolytes. Key adaptations: mitochondrial density, fat oxidation, cardiac stroke volume.', structureTr: '{E}/km\'de 60 dakika; son 25–30 dakika M-tempoda ({M}/km). 2 jel + elektrolit. Temel adaptasyonlar: mitokondri yoğunluğu, yağ oksidasyonu, kalp atım hacmi.' },
  TEMPO_2x20:         { type: 'Threshold 2×20min',         tr: 'Eşik 2×20dk',                durationMin: 55,  paceKey: 'T', zone: 4, rpeLow: 7, rpeHigh: 8, hrPctLow: 0.88, hrPctHigh: 0.92, tss: 65, structure: 'WU 10min at {E}/km. MAIN: 2×20min at T-pace ({T}/km), 60s standing rest between reps. CD 5min easy. Feel: controlled breathing, not gasping. Science: LT2 upward shift.', structureTr: 'Isınma 10dk {E}/km\'de. ANA: T-tempoda 2×20dk ({T}/km), tekrarlar arası 60s ayakta dinlenme. Soğuma 5dk kolay. His: kontrollü nefes, nefes nefese değil. Bilim: LT2 yukarı kayması.' },
  TEMPO_3x12:         { type: 'Threshold Cruise 3×12min',  tr: 'Eşik Seyir 3×12dk',          durationMin: 55,  paceKey: 'T', zone: 4, rpeLow: 7, rpeHigh: 8, hrPctLow: 0.88, hrPctHigh: 0.92, tss: 60, structure: 'WU 10min at {E}/km. MAIN: 3×12min at T-pace ({T}/km), 60s jog between reps. CD 5min easy. Shorter reps = better pace precision. Focus on holding exact {T}/km each rep.', structureTr: 'Isınma 10dk {E}/km\'de. ANA: T-tempoda 3×12dk ({T}/km), tekrarlar arası 60s yavaş koşu. Soğuma 5dk kolay. Daha kısa tekrarlar = daha iyi tempo hassasiyeti. Her tekrarda tam {T}/km tutmaya odaklan.' },
  TEMPO_2x10_TAPER:   { type: 'Taper Sharpener 2×10min',  tr: 'Azaltma Keskinleştirici 2×10dk', durationMin: 40, paceKey: 'T', zone: 4, rpeLow: 7, rpeHigh: 7, hrPctLow: 0.88, hrPctHigh: 0.92, tss: 42, structure: 'WU 10min easy. MAIN: 2×10min at T-pace ({T}/km), 60s rest. CD 10min easy. PURPOSE: sharpen neuromuscular system — NOT a training stress. Legs should feel responsive, not tired.', structureTr: 'Isınma 10dk kolay. ANA: T-tempoda 2×10dk ({T}/km), 60s dinlenme. Soğuma 10dk kolay. AMAÇ: nöromüsküler sistemi keskinleştirmek — antrenman stresi DEĞİL. Bacaklar yorgun değil, duyarlı hissettirmeli.' },
  MRACE_50:           { type: 'Marathon-Pace Run 50min',   tr: 'Maraton Tempo Koşusu 50dk',   durationMin: 50,  paceKey: 'M', zone: 3, rpeLow: 5, rpeHigh: 6, hrPctLow: 0.80, hrPctHigh: 0.87, tss: 50, structure: 'WU 10min at {E}/km. MAIN: 30min at M-pace ({M}/km). CD 10min easy. HR settles in Z3 after 10min. Aerobic economy: most efficient pace for fat-to-carb oxidation ratio.', structureTr: 'Isınma 10dk {E}/km\'de. ANA: 30dk M-tempoda ({M}/km). Soğuma 10dk kolay. Nabız 10 dakika sonra Z3\'te oturur. Aerobik ekonomi: yağ-karbonhidrat oksidasyon oranı için en verimli tempo.' },
  INTERVALS_5x1000:   { type: 'VO₂max Intervals 5×1000m', tr: 'VO₂max Aralıkları 5×1000m',   durationMin: 55,  paceKey: 'I', zone: 5, rpeLow: 8, rpeHigh: 9, hrPctLow: 0.93, hrPctHigh: 0.97, tss: 72, structure: 'WU 15min at {E}/km + 4 strides. MAIN: 5×1000m at I-pace ({I}/km), 400m jog recovery (~90s) between reps. CD 10min easy. Last rep: at-limit but reproducible. Science: VO2max upward stimulus.', structureTr: 'Isınma 15dk {E}/km\'de + 4 hız açma. ANA: I-tempoda 5×1000m ({I}/km), tekrarlar arası 400m yavaş koşu (~90s). Soğuma 10dk kolay. Son tekrar: sınırda ama tekrarlanabilir. Bilim: VO2max yukarı uyarısı.' },
  INTERVALS_6x800:    { type: 'VO₂max Intervals 6×800m',  tr: 'VO₂max Aralıkları 6×800m',   durationMin: 50,  paceKey: 'I', zone: 5, rpeLow: 8, rpeHigh: 9, hrPctLow: 0.93, hrPctHigh: 0.97, tss: 68, structure: 'WU 15min at {E}/km. MAIN: 6×800m at I-pace ({I}/km), 400m jog (~90s) between reps. CD 10min easy. Shorter reps: better pace quality, more total Z5 time. Focus on consistent splits.', structureTr: 'Isınma 15dk {E}/km\'de. ANA: I-tempoda 6×800m ({I}/km), tekrarlar arası 400m yavaş koşu (~90s). Soğuma 10dk kolay. Daha kısa tekrarlar: daha iyi tempo kalitesi, daha fazla toplam Z5 süresi. Tutarlı splitlere odaklan.' },
  INTERVALS_8x400:    { type: 'Speed Reps 8×400m',         tr: 'Hız Tekrarları 8×400m',       durationMin: 45,  paceKey: 'R', zone: 5, rpeLow: 9, rpeHigh: 10, hrPctLow: 0.95, hrPctHigh: 1.00, tss: 65, structure: 'WU 10min easy + 4 strides. MAIN: 8×400m at R-pace ({R}/km), 2–3min walk/jog recovery between reps. CD 10min easy. Pure speed + running economy. Each rep must be reproducible.', structureTr: 'Isınma 10dk kolay + 4 hız açma. ANA: R-tempoda 8×400m ({R}/km), tekrarlar arası 2–3dk yürüyüş/yavaş koşu. Soğuma 10dk kolay. Saf hız + koşu ekonomisi. Her tekrar tekrarlanabilir olmalı.' },
  INTERVALS_4x1600:   { type: 'VO₂max Intervals 4×1600m', tr: 'VO₂max Aralıkları 4×1600m',  durationMin: 60,  paceKey: 'I', zone: 5, rpeLow: 8, rpeHigh: 9, hrPctLow: 0.93, hrPctHigh: 0.97, tss: 78, structure: 'WU 15min at {E}/km. MAIN: 4×1600m at I-pace ({I}/km), 400m jog recovery (90s). CD 10min easy. Longer reps: deeper aerobic adaptation, more race-specific for 10K. Toughest session in the cycle.', structureTr: 'Isınma 15dk {E}/km\'de. ANA: I-tempoda 4×1600m ({I}/km), 400m yavaş koşu toparlanması (90s). Soğuma 10dk kolay. Daha uzun tekrarlar: daha derin aerobik adaptasyon, 10K için daha spesifik. Döngünün en zor antrenmanı.' },
  FARTLEK_30:         { type: 'Fartlek 30min',              tr: 'Fartlek 30dk',                durationMin: 30,  paceKey: 'T', zone: 3, rpeLow: 5, rpeHigh: 7, hrPctLow: 0.75, hrPctHigh: 0.88, tss: 42, structure: 'Easy 10min WU. Then 16min: 1min fast (T-pace {T}/km) / 1min easy alternating. Easy 4min CD. Unstructured speed play — ideal first quality session for beginners.', structureTr: '10dk kolay ısınma. Ardından 16dk: 1dk hızlı (T-tempo {T}/km) / 1dk kolay dönüşümlü. 4dk kolay soğuma. Yapısız hız oynaması — başlangıçlar için ideal ilk kalite antrenman.' },
  RACE_SIM_6K:        { type: 'Race Simulation 6K',         tr: 'Yarış Simülasyonu 6K',        durationMin: 50,  paceKey: 'I', zone: 5, rpeLow: 8, rpeHigh: 9, hrPctLow: 0.90, hrPctHigh: 0.97, tss: 68, structure: 'WU 15min easy. MAIN: 6K continuous at goal 10K race pace ({I}/km approx). CD 10min easy. Rehearse race pace, pacing strategy, and mental execution at race-like stress.', structureTr: 'Isınma 15dk kolay. ANA: Hedef 10K yarış temposunda 6K sürekli ({I}/km yaklaşık). Soğuma 10dk kolay. Yarış temposunu, pace stratejisini ve yarış benzeri stres altında zihinsel uygulamayı prova et.' },
  EASY_STRIDES:       { type: 'Easy 30min + Strides',       tr: 'Kolay 30dk + Hız Açmalar',   durationMin: 42,  paceKey: 'E', zone: 2, rpeLow: 3, rpeHigh: 5, hrPctLow: 0.65, hrPctHigh: 0.80, tss: 28, structure: 'Easy 30min at {E}/km. Then 4–6 strides of 80m at R-pace ({R}/km) with full walk recovery. Taper activation: keep leg turnover without accumulating fatigue.', structureTr: '{E}/km\'de kolay 30dk. Ardından R-tempoda 80m 4–6 hız açma ({R}/km), tam yürüyüş toparlanmasıyla. Azaltma aktivasyonu: yorgunluk biriktirmeden bacak devir hızını koru.' },
  EASY_20_STRIDES:    { type: 'Easy 20min + Race Strides',  tr: 'Kolay 20dk + Yarış Hız Açmaları', durationMin: 30, paceKey: 'E', zone: 1, rpeLow: 3, rpeHigh: 5, hrPctLow: 0.60, hrPctHigh: 0.79, tss: 18, structure: 'Short easy 20min at {E}/km. Then 4–6 strides at race pace. Very light — just neuromuscular activation before race day. Do not fatigue.', structureTr: 'Kısa kolay 20dk {E}/km\'de. Ardından yarış temposunda 4–6 hız açma. Çok hafif — sadece yarış gününden önce nöromüsküler aktivasyon. Yorma.' },
  RACE_DAY:           { type: 'RACE DAY',                   tr: 'YARIŞ GÜNÜ',                  durationMin: 60,  paceKey: null, zone: 5, rpeLow: 9, rpeHigh: 10, hrPctLow: null, hrPctHigh: null, tss: 70, structure: 'WU: 10–15min easy + 4–6 race-pace strides. Execute your race plan. Pacing strategy: first 4K at goal pace, hold through 8K, empty tank in final 2K. Negative split target: first 5K 2–3s/km slower than goal.', structureTr: 'Isınma: 10–15dk kolay + 4–6 yarış temposu hız açma. Yarış planını uygula. Pace stratejisi: ilk 4K hedef tempoda, 8K\'ya kadar tut, son 2K\'da tankı boşalt. Negatif split: ilk 5K hedeften 2–3s/km yavaş.' },
}

// ── Weekly day configurations per phase ───────────────────────────────────────
// runKey: key in RUN_SESSIONS | null
// strengthKey: key in STRENGTH_WORKOUTS | null
// drillsIdx: index in DRILL_CIRCUITS (0=beginner, 1=intermediate, 2=advanced) | null
// preventiveKey: key in PREVENTIVE_ROUTINES | null
const WEEK_CONFIGS = {
  Base: [
    { day: 'Mon', dayTr: 'Pzt', runKey: null,              strengthKey: null,                 drillsIdx: null, preventiveKey: 'hip_glute'     },
    { day: 'Tue', dayTr: 'Sal', runKey: 'EASY_40',         strengthKey: null,                 drillsIdx: 0,    preventiveKey: null            },
    { day: 'Wed', dayTr: 'Çar', runKey: null,              strengthKey: 'foundation_lower',   drillsIdx: null, preventiveKey: null            },
    { day: 'Thu', dayTr: 'Per', runKey: 'EASY_50',         strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
    { day: 'Fri', dayTr: 'Cum', runKey: null,              strengthKey: 'foundation_core',    drillsIdx: null, preventiveKey: 'calf_achilles' },
    { day: 'Sat', dayTr: 'Cmt', runKey: 'LONG_60_75',     strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
    { day: 'Sun', dayTr: 'Paz', runKey: null,              strengthKey: null,                 drillsIdx: null, preventiveKey: 'full_mobility' },
  ],
  Build: [
    { day: 'Mon', dayTr: 'Pzt', runKey: null,              strengthKey: null,                 drillsIdx: null, preventiveKey: 'hip_glute'     },
    { day: 'Tue', dayTr: 'Sal', runKey: 'TEMPO_2x20',     strengthKey: null,                 drillsIdx: 1,    preventiveKey: null            },
    { day: 'Wed', dayTr: 'Çar', runKey: 'EASY_40',        strengthKey: 'progressive_lower',  drillsIdx: null, preventiveKey: null            },
    { day: 'Thu', dayTr: 'Per', runKey: 'MRACE_50',       strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
    { day: 'Fri', dayTr: 'Cum', runKey: null,             strengthKey: 'progressive_power',  drillsIdx: null, preventiveKey: 'calf_achilles' },
    { day: 'Sat', dayTr: 'Cmt', runKey: 'LONG_75_90',    strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
    { day: 'Sun', dayTr: 'Paz', runKey: 'RECOVERY_30',   strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
  ],
  Peak: [
    { day: 'Mon', dayTr: 'Pzt', runKey: null,             strengthKey: 'maintenance_a',      drillsIdx: null, preventiveKey: 'hip_glute'     },
    { day: 'Tue', dayTr: 'Sal', runKey: 'INTERVALS_5x1000', strengthKey: null,              drillsIdx: 2,    preventiveKey: null            },
    { day: 'Wed', dayTr: 'Çar', runKey: 'EASY_40',       strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
    { day: 'Thu', dayTr: 'Per', runKey: 'TEMPO_3x12',    strengthKey: 'maintenance_b',      drillsIdx: null, preventiveKey: null            },
    { day: 'Fri', dayTr: 'Cum', runKey: null,             strengthKey: null,                 drillsIdx: null, preventiveKey: 'calf_achilles' },
    { day: 'Sat', dayTr: 'Cmt', runKey: 'RACE_SIM_6K',  strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
    { day: 'Sun', dayTr: 'Paz', runKey: 'RECOVERY_40',  strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
  ],
  Taper: [
    { day: 'Mon', dayTr: 'Pzt', runKey: null,             strengthKey: null,                 drillsIdx: null, preventiveKey: 'full_mobility' },
    { day: 'Tue', dayTr: 'Sal', runKey: 'EASY_STRIDES',  strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
    { day: 'Wed', dayTr: 'Çar', runKey: null,             strengthKey: null,                 drillsIdx: null, preventiveKey: 'hip_glute'     },
    { day: 'Thu', dayTr: 'Per', runKey: 'TEMPO_2x10_TAPER', strengthKey: null,              drillsIdx: null, preventiveKey: null            },
    { day: 'Fri', dayTr: 'Cum', runKey: null,             strengthKey: null,                 drillsIdx: null, preventiveKey: 'calf_achilles' },
    { day: 'Sat', dayTr: 'Cmt', runKey: 'EASY_20_STRIDES', strengthKey: null,              drillsIdx: null, preventiveKey: null            },
    { day: 'Sun', dayTr: 'Paz', runKey: 'RACE_DAY',      strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
  ],
  Deload: [
    { day: 'Mon', dayTr: 'Pzt', runKey: null,             strengthKey: null,                 drillsIdx: null, preventiveKey: 'full_mobility' },
    { day: 'Tue', dayTr: 'Sal', runKey: 'EASY_30',        strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
    { day: 'Wed', dayTr: 'Çar', runKey: null,             strengthKey: 'foundation_lower',   drillsIdx: null, preventiveKey: null            },
    { day: 'Thu', dayTr: 'Per', runKey: 'EASY_30',        strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
    { day: 'Fri', dayTr: 'Cum', runKey: null,             strengthKey: null,                 drillsIdx: null, preventiveKey: 'hip_glute'     },
    { day: 'Sat', dayTr: 'Cmt', runKey: 'LONG_60_75',    strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
    { day: 'Sun', dayTr: 'Paz', runKey: null,             strengthKey: null,                 drillsIdx: null, preventiveKey: null            },
  ],
}

// ── Main builder ───────────────────────────────────────────────────────────────
/**
 * Build a complete 7-day training schedule for a given phase and VDOT.
 * Each day includes running prescription, strength, drills, and preventive work
 * as appropriate. Paces are computed from vdot; HR ranges from maxHR.
 *
 * @param {'Base'|'Build'|'Peak'|'Taper'|'Deload'} phase
 * @param {number}      vdot         Current VDOT (e.g. 33 for 50:00/10km athlete)
 * @param {number}      weekInPhase  1-based week within this phase (unused currently, reserved)
 * @param {number|null} maxHR        Athlete maxHR for HR range computation (optional)
 * @returns {Array<DayPlan>}         7 day objects
 */
export function buildFullWeekPlan(phase, vdot, weekInPhase = 1, maxHR = null) {
  const pacesRaw = vdot ? trainingPaces(vdot) : null
  const paces = pacesRaw ? {
    E: fmtPace(pacesRaw.E),
    M: fmtPace(pacesRaw.M),
    T: fmtPace(pacesRaw.T),
    I: fmtPace(pacesRaw.I),
    R: fmtPace(pacesRaw.R),
  } : {}

  const configs = WEEK_CONFIGS[phase] ?? WEEK_CONFIGS.Base

  return configs.map(cfg => {
    // ── Running session ────────────────────────────────────────────────────────
    let run = null
    const runTemplate = cfg.runKey ? RUN_SESSIONS[cfg.runKey] : null
    if (runTemplate) {
      const paceStr = runTemplate.paceKey && pacesRaw ? fmtPace(pacesRaw[runTemplate.paceKey]) : null
      const hrLow  = (runTemplate.hrPctLow  && maxHR) ? Math.round(maxHR * runTemplate.hrPctLow)  : null
      const hrHigh = (runTemplate.hrPctHigh && maxHR) ? Math.round(maxHR * runTemplate.hrPctHigh) : null
      run = {
        type:        runTemplate.type,
        tr:          runTemplate.tr,
        durationMin: runTemplate.durationMin,
        paceKey:     runTemplate.paceKey,
        paceStr,
        hrLow, hrHigh,
        rpeLow:      runTemplate.rpeLow,
        rpeHigh:     runTemplate.rpeHigh,
        zone:        runTemplate.zone,
        structure:   injectPaces(runTemplate.structure, paces),
        structureTr: injectPaces(runTemplate.structureTr, paces),
        tss:         runTemplate.tss,
      }
    }

    // ── Strength session ───────────────────────────────────────────────────────
    const strength = cfg.strengthKey ? (STRENGTH_WORKOUTS[cfg.strengthKey] ?? null) : null

    // ── Drills circuit ─────────────────────────────────────────────────────────
    const drills = (cfg.drillsIdx != null) ? (DRILL_CIRCUITS[cfg.drillsIdx] ?? null) : null

    // ── Preventive routine ─────────────────────────────────────────────────────
    const preventive = cfg.preventiveKey ? (PREVENTIVE_ROUTINES[cfg.preventiveKey] ?? null) : null

    // ── Backward-compat top-level fields (used by existing tests + card) ───────
    const primaryType = run?.type ?? strength?.name ?? preventive?.name ?? 'Rest'
    const primaryTr   = run?.tr   ?? strength?.tr   ?? preventive?.tr   ?? 'Dinlenme'
    const zone        = run?.zone ?? 1
    const paceKey     = run?.paceKey ?? null
    const paceStr     = run?.paceStr ?? null
    const totalDurationMin =
      (run?.durationMin ?? 0) +
      (drills?.durationMin ?? 0) +
      (strength?.durationMin ?? 0) +
      (preventive?.durationMin ?? 0)

    return {
      // Backward-compat (RaceGoalDashCard, trainingBridge tests)
      day:    cfg.day,
      dayTr:  cfg.dayTr,
      type:   primaryType,
      tr:     primaryTr,
      pace:   paceKey,
      zone,
      paceStr,
      // Rich modality data
      run,
      strength,
      drills,
      preventive,
      totalDurationMin,
    }
  })
}
