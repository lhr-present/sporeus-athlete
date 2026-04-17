# Sporeus Athlete v8 — Yenilikler / What's New

---

## TR — Sporeus Athlete v8: Antrenman Takibinin Yeni Seviyesi

Sporeus Athlete v8, tek bir büyük sprint'te hayata geçirilen sekiz altyapı ve özellik bloğunu bir araya getiriyor. Artık hem bireysel sporcular hem de koçlar için daha güçlü, daha hızlı ve daha akıllı bir platform sunuyoruz.

### Aktivite Dosyası Yükleme
FIT, GPX ve CSV dosyalarını doğrudan antrenman günlüğüne yükle. Sistem otomatik olarak NP, TSS, güç bölgelerini ve aerobik bağımlılığı hesaplıyor.

### Oturum Başına Yapay Zekâ Koçluğu
Her antrenman sonrası otomatik AI koçluk notu. Antrenman yükü, sakatlanma geçmişi ve HRV verilerini birleştirerek kişiye özel geri bildirim oluşturuyor.

### Doğal Dil ile Antrenman Arama
Geçmiş antrenmanlarda "uzun tempo koşusu" veya "yüksek yük haftası" gibi cümlelerle arama yap. pgvector destekli anlamsal arama, antrenman tarihine ayna tutuyor.

### Gerçek Zamanlı Takım Paneli
Koçlar, sporcularının antrenmanlara ve iyileşme verilerine anlık olarak ulaşabiliyor. Yazma indikatörü, okundu bilgisi, canlı katılım sayacı.

### PDF Rapor Oluşturma
Haftalık sporcu raporu, aylık takım özeti, yarış hazırlığı analizi — tek tıkla PDF çıktısı. Koç ve Kulüp paketlerine özel.

### Sürekli Arama (Ctrl+K)
Türkçe karakter desteğiyle birlikte oturumlar, notlar, mesajlar ve sporcular arasında anında arama. Koç/Kulüp paketi için anlamsal mod dahil.

### Daha Hızlı Takım Metrikleri
Önceden hesaplanmış CTL/ATL değerleri sayesinde antrenman durumu tablosu artık ~3× daha hızlı yükleniyor.

---

### Neden v8.0?

Bu güncellemeyle Sporeus, kişisel günlükten gerçek bir performans platformuna evrildi. 1735 test, 46 veritabanı migrasyonu ve 21 uç fonksiyon ile altyapı üretim ortamına tam hazır.

**Sporeus Athlete — sporeus.com/join**

---

## EN — Sporeus Athlete v8: Training Intelligence, Elevated

Sporeus Athlete v8 ships eight major enhancement blocks — activity file parsing, AI session coaching, semantic search, realtime squad presence, PDF reports, async queue workers, full-text search, and materialized view hardening — all in a single sprint.

### Upload Any Activity File
Drag and drop FIT, GPX, or CSV files. The app automatically computes NP, TSS, power zones, and aerobic decoupling and adds the session to your log.

### AI Coaching on Every Session
Every workout gets an automatic AI coach note — factoring in your 14-day training context, 90-day fitness curve, injury history, and HRV trend.

### Search Your Training History in Plain Language
Ask "hard hill session" or "high TSS week" and get ranked results from your entire training archive. Powered by OpenAI embeddings + HNSW vector search. Coach and Club tier.

### Live Squad Dashboard
Coaches see athlete training and recovery events as they happen. Typing indicators, read receipts, live RSVP counts — all realtime via Supabase channels.

### Downloadable PDF Reports
Weekly athlete recap, monthly squad summary, race readiness brief — one click, signed download link. Coach+ and Club tier.

### Global Search (Ctrl+K)
Instant search across sessions, coach notes, messages, announcements, and athletes — with full Turkish diacritic normalization. Semantic mode for Coach and Club.

### Faster Squad Metrics
Pre-computed CTL/ATL materialized views mean squad readiness loads ~3× faster, even with large rosters.

---

### Why v8.0?

v8.0.0 marks Sporeus' transition from a personal training log to a full performance platform. 1 735 automated tests, 46 database migrations, 21 edge functions, and complete infrastructure for Coach and Club tiers at scale.

**Sporeus Athlete — sporeus.com/join**
