# What's New in Sporeus v8.1 — Marketing Copy

---

## Twitter / X Thread

**Tweet 1 (hook)**
Sporeus Athlete v8.1 is live.

9 hardening sprints. 284 new tests. 44% smaller bundle. Properly observable payments.

This is the "we are done with v8" marker. Thread 🧵

---

**Tweet 2 (security)**
First thing we did: audit every RLS policy.

Found 5 real bugs — one let any user inject fake AI advice for another athlete. Fixed. 220+ automated tests now guard every policy on every table.

Security isn't a feature. It's the foundation.

---

**Tweet 3 (payments)**
Payments are now idempotent.

Before: a network retry could charge twice. Now: UNIQUE(webhook_source, event_id) in `processed_webhooks` makes replay safe. `apply_tier_change()` wraps tier update + audit trail in one atomic transaction.

---

**Tweet 4 (observability)**
You can't improve what you can't see.

v8.1 adds: system status monitoring, Telegram alerts, weekly operator digest, Axiom dashboards for latency/errors/funnel, and a client telemetry pipeline.

First time we know if something breaks before users report it.

---

**Tweet 5 (Turkish)**
Türkçe tam desteği.

TR/EN çeviri paritesi CI'da zorlanıyor. Eksik anahtar varsa test başarısız oluyor. Grafik ARIA etiketleri, 44px dokunma hedefleri, iOS çentik desteği, odak halkası. WCAG 2.1 AA.

---

**Tweet 6 (numbers)**
The numbers:

- 2019 tests (was 1735)
- 55 migrations
- 25 edge functions
- 84 kB bundle (was 150 kB)
- 0 TODO/FIXME/HACK in source
- Full attribution pipeline for conversion tracking

---

**Tweet 7 (CTA)**
If you're a coach, endurance athlete, or building anything similar —

App: app.sporeus.com
Coach plan: 14-day free trial, no CC required
Codebase: everything built with Claude Code in 5 weeks

What's next: v9 discovery. Native mobile, wearable integrations, coach marketplace.

---

## LinkedIn Post

---

I spent 5 weeks hardening a production athlete app. Here's what I learned.

**Sporeus Athlete Console v8.1.0 is the result of 9 focused sprints** — not adding features, but making the existing ones bulletproof.

Here's what "hardening" actually meant:

**C1 — Contract audit:** Four silent bugs found and fixed. `generate-report` was computing CTL/ATL/TSB as 0 for every user because it read the wrong column names from a materialized view. Coaches couldn't search athlete sessions. AI insight embeddings were never being written.

**C2 — Security:** One HIGH bug — any authenticated user could inject fake AI coaching advice for any other athlete's profile. Fixed in a single RLS policy change + automated test suite (220+ tests, 4 personas).

**C3 — Telemetry:** 21 edge functions had zero observability. Silent failures. Now every function emits structured events to Axiom, every cron worker sends a heartbeat.

**C4 — Performance:** Main bundle went from 150 kB to 84 kB gzip by wrapping 9 tab components in `React.lazy()`. Perf SLOs locked with a harness running 18k seeded sessions.

**C5 — Observability:** System status dashboard, Telegram alerts, weekly operator email, 5 Axiom dashboards. First time I'd know if Supabase realtime goes down before users report it.

**C6/C7 — UX + i18n:** Turkish translation gaps caught by automated CI parity tests. WCAG 2.1 AA charts, 44px tap targets, safe-area insets. `window.confirm()` replaced with proper accessible dialogs.

**C8 — Payments:** Webhook idempotency (UNIQUE constraint dedup), atomic tier transitions (`apply_tier_change()` SQL function), 3-day grace periods, upgrade modal, billing audit trail.

**C9 — Attribution:** UTM capture, conversion funnels, anonymous → user stitching. Flew blind before this sprint.

**The meta-lesson:**

"Feature-complete" and "production-grade" are very different things.

The app had 38 DB tables, 20 edge functions, and 1735 tests at v8.0.0. It was feature-complete. But there were silent payment bugs, RLS vulnerabilities, zero observability, and no conversion tracking.

v8.1.0 is when I'd actually trust it with real users.

---

Sporeus is a training load analytics app for endurance athletes and their coaches. Turkish/English bilingual, PWA, offline-capable.

Built entirely with Claude Code. app.sporeus.com

#TrainingLoad #AthleteTracking #Supabase #React #ClaudeCode #IndieHacking

---

## Sporeus.com Changelog Post

### 🇹🇷 Türkçe

**Sporeus v8.1 yayında**

Bu güncelleme, 9 yoğun sertleştirme sprintiyle oluşturuldu. Yeni özellik yok — mevcut her şeyin sağlam çalışmasını sağladık.

**Güvenlik**
- Tüm RLS politikaları denetlendi ve 5 güvenlik açığı kapatıldı
- Webhook idempotency: aynı ödeme olayı artık iki kez işlenemiyor
- Ödeme geçişleri artık atomik: tier güncellemesi + denetim kaydı tek işlemde

**Türkçe Desteği**
- TR/EN çeviri paritesi CI'da otomatik kontrol ediliyor
- SemanticSearch ve LiveSquadFeed tam Türkçe desteğine kavuştu
- WCAG 2.1 AA: grafikler için ekran okuyucu etiketleri, 44px dokunma hedefleri

**Gözlemlenebilirlik**
- Sistem durum izleme paneli
- Hizmet kesintilerinde Telegram bildirimi
- Haftalık operatör özet e-postası

**Performans**
- Ana paket boyutu 84 kB'a düştü (önceden 150 kB)
- Sayfa yükleme süresi ~40% iyileşti

**Coach Planı**
- 14 günlük ücretsiz deneme (kredi kartı gerekmez)
- Ödeme gecikme durumunda 3 günlük tolerans süresi
- Plan yükseltme modalı: özellik karşılaştırma tablosu dahil

---

### 🇬🇧 English

**Sporeus v8.1 is live**

Nine hardening sprints. No new features — just making everything that existed actually production-grade.

**Security**
- Full RLS policy audit; 5 real vulnerabilities closed
- Webhook idempotency: duplicate payment events are safely deduplicated
- Atomic tier transitions: `apply_tier_change()` wraps profile update + billing audit in one DB transaction

**Turkish Support**
- TR/EN translation parity enforced in CI — a missing key fails the build
- SemanticSearch and LiveSquadFeed now fully bilingual
- WCAG 2.1 AA: chart screen reader labels, 44px touch targets, iOS safe-area insets

**Observability**
- System status dashboard in admin panel
- Telegram alerts for service degradation
- Weekly operator digest email (MAU/DAU/revenue/queue health)

**Performance**
- Main bundle down to 84 kB gzip (from 150 kB — −44%)
- Page load improved ~40%

**Coach Plan**
- 14-day free trial, no credit card required
- 3-day grace period on payment failure
- Upgrade modal with feature comparison table (TRY / EUR pricing)
