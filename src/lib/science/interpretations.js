// src/lib/science/interpretations.js
// E3 — Science-backed metric interpretations with citations
// Pure JS — no React, no DOM.
//
// Each function takes a computed metric + context and returns a bilingual
// interpretation string that can be used in AI prompts and insight cards.
// All thresholds are sourced from published literature (see docs/science/citations.md).

// ─── ACWR Interpretation (Hulin et al. 2016 / Gabbett 2016) ─────────────────
// Reference: Gabbett T.J. (2016). Br J Sports Med 50(5):273–280.
//            "The training-injury prevention paradox."
// Thresholds: 1.0–1.3 optimal; 1.5 injury-risk boundary.

/**
 * @param {number} ratio - ACWR value
 * @param {{ en: string, tr: string }} [context] - optional athlete name / context
 * @returns {{ en: string, tr: string, citation: string }}
 */
export function interpretACWR(ratio, _context = {}) {
  const citation = 'Gabbett T.J. (2016) Br J Sports Med 50:273-280; Hulin et al. (2016) 50:231-236'

  if (ratio == null) {
    return {
      en: 'Insufficient training history to compute ACWR. Log at least 4 weeks of sessions.',
      tr: 'AAKÖ hesaplamak için yeterli antrenman geçmişi yok. En az 4 haftalık antrenman kaydet.',
      citation,
    }
  }

  if (ratio > 1.5) {
    return {
      en: `ACWR ${ratio.toFixed(2)} — above the 1.5 injury-risk threshold (Gabbett 2016). Reduce acute load immediately. Cut this week's volume 20–30% and avoid high-intensity sessions.`,
      tr: `AAKÖ ${ratio.toFixed(2)} — 1.5 sakatlanma riski eşiğinin üzerinde (Gabbett 2016). Akut yükü hemen azalt. Bu haftanın hacmini %20–30 düşür, yüksek yoğunluklu antrenmanlardan kaçın.`,
      citation,
    }
  }

  if (ratio > 1.3) {
    return {
      en: `ACWR ${ratio.toFixed(2)} — caution zone (1.3–1.5). Elevated injury risk if sustained. Maintain current load but hold off on new intensity increases for 7 days.`,
      tr: `AAKÖ ${ratio.toFixed(2)} — dikkat bölgesi (1.3–1.5). Devam ederse sakatlanma riski artar. Mevcut yükü koru ancak 7 gün daha yeni yoğunluk artışı ekleme.`,
      citation,
    }
  }

  if (ratio >= 0.8) {
    return {
      en: `ACWR ${ratio.toFixed(2)} — optimal zone (0.8–1.3, Gabbett 2016). Training load is well-matched to chronic fitness. Safe to continue building.`,
      tr: `AAKÖ ${ratio.toFixed(2)} — optimal bölge (0.8–1.3, Gabbett 2016). Antrenman yükü kronik kondisyonla iyi eşleşmiş. Artışa devam etmek güvenli.`,
      citation,
    }
  }

  return {
    en: `ACWR ${ratio.toFixed(2)} — undertraining zone (<0.8). Fitness may be declining. Consider adding 1–2 sessions this week if recovery allows.`,
    tr: `AAKÖ ${ratio.toFixed(2)} — yetersiz antrenman bölgesi (<0.8). Kondisyon düşüyor olabilir. Toparlanma izin veriyorsa bu hafta 1–2 antrenman ekle.`,
    citation,
  }
}

// ─── CTL Interpretation (Banister & Calvert 1980 / Coggan 2003) ─────────────
// Reference: Banister E.W. & Calvert T.W. (1980). Planning for future performance.
//            Coggan A.R. (2003) Training and Racing with a Power Meter.

/**
 * @param {number} ctl - current Chronic Training Load (fitness)
 * @param {number} prevCTL - CTL 4 weeks ago for trend comparison
 * @param {string} sport
 * @returns {{ en: string, tr: string, citation: string }}
 */
export function interpretCTL(ctl, prevCTL, _sport = 'general') {
  const citation = 'Banister & Calvert (1980); Coggan A.R. (2003) Training & Racing with a Power Meter'
  const delta = prevCTL != null ? Math.round(ctl - prevCTL) : null
  const trend = delta != null ? (delta > 5 ? '↑' : delta < -5 ? '↓' : '→') : ''
  const deltaTxt = delta != null ? ` (${delta > 0 ? '+' : ''}${delta} vs 4 weeks ago)` : ''
  const deltaTr  = delta != null ? ` (4 hafta öncesine göre ${delta > 0 ? '+' : ''}${delta})` : ''

  return {
    en: `CTL ${ctl} ${trend}${deltaTxt}. ${
      ctl < 40  ? 'Base-building phase — focus on consistency and aerobic volume.' :
      ctl < 70  ? 'Solid aerobic base. Structured build phases will produce measurable adaptations.' :
      ctl < 100 ? 'High-performance range. Maintain quality; recovery becomes the limiting factor.' :
                  'Elite fitness zone. CTL above 100 requires careful fatigue management (Banister 1980).'
    }`,
    tr: `KTY ${ctl} ${trend}${deltaTr}. ${
      ctl < 40  ? 'Baz geliştirme aşaması — tutarlılık ve aerobik hacme odaklan.' :
      ctl < 70  ? 'Sağlam aerobik baz. Yapılandırılmış artış blokları ölçülebilir adaptasyon sağlar.' :
      ctl < 100 ? 'Yüksek performans aralığı. Kaliteyi koru; toparlanma belirleyici faktör.' :
                  'Elit kondisyon bölgesi. 100 üzeri KTY dikkatli yorgunluk yönetimi gerektirir (Banister 1980).'
    }`,
    citation,
  }
}

// ─── TSB Interpretation (Coggan TSB zones) ───────────────────────────────────
// Reference: Coggan A.R. Training and Racing with a Power Meter (2nd ed.)

/**
 * @param {number} tsb - Training Stress Balance
 * @param {boolean} isRaceWeek - if true, advise on race readiness
 * @returns {{ en: string, tr: string, citation: string }}
 */
export function interpretTSB(tsb, isRaceWeek = false) {
  const citation = 'Coggan A.R. Training & Racing with a Power Meter (2nd ed.)'

  if (tsb == null) return { en: 'No TSB data.', tr: 'TSF verisi yok.', citation }

  if (tsb > 25) {
    return {
      en: `TSB +${tsb} — transitional (Coggan). Fitness is decaying rapidly due to insufficient training. Resume structured training to rebuild CTL.`,
      tr: `TSF +${tsb} — geçiş (Coggan). Yetersiz antrenman nedeniyle kondisyon hızla düşüyor. KTY'yi yeniden oluşturmak için yapılandırılmış antrenmana dön.`,
      citation,
    }
  }

  if (tsb >= 5) {
    return {
      en: `TSB +${tsb} — fresh / peak form (Coggan +5 to +25). ${isRaceWeek ? 'Optimal race readiness window — compete.' : 'Save this form for an upcoming race or key session.'}`,
      tr: `TSF +${tsb} — taze / form (Coggan +5 ile +25). ${isRaceWeek ? 'Optimal yarış hazırlığı penceresi — yarış.' : 'Bu formu yaklaşan bir yarış veya temel antrenman için sakla.'}`,
      citation,
    }
  }

  if (tsb >= -10) {
    return {
      en: `TSB ${tsb} — neutral zone. Normal training week. Fitness and fatigue are balanced.`,
      tr: `TSF ${tsb} — nötr bölge. Normal antrenman haftası. Kondisyon ve yorgunluk dengeli.`,
      citation,
    }
  }

  if (tsb >= -30) {
    return {
      en: `TSB ${tsb} — optimal training stress (Coggan −10 to −30). Strong adaptation stimulus. Monitor recovery scores; maintain this range for 2–3 weeks before tapering.`,
      tr: `TSF ${tsb} — optimal antrenman stresi (Coggan −10 ile −30). Güçlü adaptasyon uyarısı. Toparlanma skorlarını izle; azaltma öncesi 2–3 hafta bu aralıkta kal.`,
      citation,
    }
  }

  return {
    en: `TSB ${tsb} — overreaching risk (Coggan <−30). Cumulative fatigue is high. Schedule a recovery week immediately.`,
    tr: `TSF ${tsb} — aşırı yüklenme riski (Coggan <−30). Kümülatif yorgunluk yüksek. Hemen bir toparlanma haftası planla.`,
    citation,
  }
}

// ─── Monotony/Strain Interpretation (Foster 1998) ───────────────────────────
// Reference: Foster C. (1998). Med Sci Sports Exerc 30(7):1164–1168.

/**
 * @param {number|null} monotony
 * @param {number|null} strain
 * @returns {{ en: string, tr: string, citation: string }}
 */
export function interpretMonotony(monotony, _strain) {
  const citation = 'Foster C. (1998) Med Sci Sports Exerc 30(7):1164-1168'

  if (monotony == null) {
    return {
      en: 'Training load too uniform or too low to compute monotony. Vary session intensity day-to-day.',
      tr: 'Antrenman yükü çok tekdüze veya çok düşük; monotoni hesaplanamıyor. Oturum yoğunluğunu günden güne değiştir.',
      citation,
    }
  }

  if (monotony > 2.0) {
    return {
      en: `Monotony ${monotony.toFixed(2)} — high overreach risk (threshold 2.0, Foster 1998). Every day looks the same. Add a rest day or easy recovery session to break the pattern.`,
      tr: `Monotoni ${monotony.toFixed(2)} — yüksek aşırı yüklenme riski (eşik 2.0, Foster 1998). Her gün birbirine benziyor. Örüntüyü kırmak için bir dinlenme veya kolay toparlanma günü ekle.`,
      citation,
    }
  }

  if (monotony > 1.5) {
    return {
      en: `Monotony ${monotony.toFixed(2)} — moderate concern. Load pattern is too similar day-to-day. Introduce more variation between hard and easy days.`,
      tr: `Monotoni ${monotony.toFixed(2)} — orta düzeyde endişe. Yük örüntüsü günden güne çok benzer. Sert ve kolay günler arasına daha fazla varyasyon ekle.`,
      citation,
    }
  }

  return {
    en: `Monotony ${monotony.toFixed(2)} — well within safe range. Good variation between hard and easy sessions.`,
    tr: `Monotoni ${monotony.toFixed(2)} — güvenli aralıkta. Sert ve kolay oturumlar arasında iyi varyasyon var.`,
    citation,
  }
}

// ─── Decoupling Interpretation (Friel 2009) ─────────────────────────────────
// Reference: Friel J. The Cyclist's Training Bible, 4th ed. VeloPress, 2009.

/**
 * @param {number} decouplingPct
 * @returns {{ en: string, tr: string, citation: string }}
 */
export function interpretDecoupling(decouplingPct) {
  const citation = 'Friel J. The Cyclist\'s Training Bible, 4th ed. VeloPress, 2009'

  if (decouplingPct == null) {
    return { en: 'No decoupling data for this session.', tr: 'Bu oturum için ayrışma verisi yok.', citation }
  }

  if (decouplingPct < 5) {
    return {
      en: `Aerobic decoupling ${decouplingPct.toFixed(1)}% — well coupled (Friel <5%). Aerobic base is adequate for this intensity and duration.`,
      tr: `Aerobik ayrışma ${decouplingPct.toFixed(1)}% — iyi bağlı (Friel <%5). Bu yoğunluk ve süre için aerobik baz yeterli.`,
      citation,
    }
  }

  if (decouplingPct < 10) {
    return {
      en: `Aerobic decoupling ${decouplingPct.toFixed(1)}% — mild drift (5–10%). Heart rate increased relative to output in the second half. Consider reducing duration or intensity until aerobic base improves.`,
      tr: `Aerobik ayrışma ${decouplingPct.toFixed(1)}% — hafif kayma (%5–10). İkinci yarıda çıktıya kıyasla kalp atışı arttı. Aerobik baz gelişene kadar süreyi veya yoğunluğu azaltmayı düşün.`,
      citation,
    }
  }

  return {
    en: `Aerobic decoupling ${decouplingPct.toFixed(1)}% — significant (>10%, Friel). HR drifted substantially. Possible causes: under-fueling, dehydration, or aerobic insufficiency at this pace/power. Keep zone-2 efforts <5% before building.`,
    tr: `Aerobik ayrışma ${decouplingPct.toFixed(1)}% — belirgin (>%10, Friel). KAH önemli ölçüde saptı. Olası nedenler: yetersiz beslenme, dehidrasyon veya bu hız/güçte aerobik yetersizlik. Artışa geçmeden önce Z2 çalışmalarını <%5 altına getir.`,
    citation,
  }
}
