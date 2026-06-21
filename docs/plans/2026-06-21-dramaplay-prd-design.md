# PRD Dramaplay — Mobile-First Vertical Short Drama Platform

**Date:** 2026-06-21  
**Status:** Draft Final  
**Owner:** Dramaplay  
**Document Type:** Product Requirements Document + High-Level Technical Design

---

## 1. Executive Summary

Dramaplay adalah platform streaming **mobile-first vertical short drama** untuk pasar Indonesia. Produk ini berfokus pada drama pendek berdurasi 1–5 menit per episode, format vertikal, dan pengalaman menonton cepat seperti short-video apps, tetapi tetap memiliki struktur katalog seperti platform streaming.

Dramaplay akan menjadi **multi-provider short drama aggregator**. Konten berasal dari berbagai third-party provider API dengan pola API mirip layanan seperti Sansekai-style API: listing, search, detail, episode list, dan stream resolve. Dramaplay tidak bergantung pada satu provider; semua data provider dinormalisasi ke model internal Dramaplay.

MVP berfokus pada:

- katalog short drama besar dan dinamis,
- pengalaman PWA mobile-first,
- Android app via Capacitor,
- video player vertikal yang stabil di mobile browser,
- subscription/VIP-first monetization,
- payment via Pakasir,
- full admin panel,
- provider sync dan health monitoring,
- analytics internal + Google Analytics/Plausible,
- deployment hemat dengan Cloudflare Free-oriented architecture.

---

## 2. Product Vision

Menjadi platform utama untuk menikmati short drama vertikal di Indonesia dengan katalog besar dari berbagai provider, pengalaman mobile yang ringan, dan model VIP subscription yang mudah dipahami.

Dramaplay harus terasa seperti:

- cepat seperti TikTok/Reels/Shorts,
- rapi seperti Netflix/WeTV,
- ringan untuk pengguna mobile Indonesia,
- fleksibel untuk ingest konten dari banyak provider,
- siap dimonetisasi melalui subscription/VIP.

---

## 3. Target Market

### Primary Market

Indonesia.

Implikasi:

- bahasa utama: Bahasa Indonesia,
- UX mobile-first,
- payment lokal melalui Pakasir,
- konten diprioritaskan untuk pengguna Indonesia,
- subtitle Indonesia menjadi default,
- harga subscription harus cocok untuk pasar lokal.

### Primary User Persona

**Gen Z dan Milenial muda usia 18–30 tahun yang menyukai drama Asia dan terbiasa mengonsumsi short-form video.**

Karakteristik:

- sering menonton via smartphone,
- familiar dengan TikTok, Reels, Shorts,
- menyukai konten cepat, emosional, dan cliffhanger,
- tertarik pada drama Asia seperti C-Drama, K-Drama, Thai Drama, J-Drama, dan vertical micro drama,
- membutuhkan subtitle Indonesia,
- mudah membagikan konten via WhatsApp, Instagram, TikTok, Telegram, dan social platform lain.

---

## 4. Problem Statement

Pengguna Indonesia yang menyukai drama Asia dan short-form video belum memiliki platform yang secara khusus menggabungkan:

- short drama vertikal,
- episode singkat 1–5 menit,
- katalog besar multi-provider,
- subtitle Indonesia,
- pengalaman mobile-first,
- discovery cepat,
- monetisasi VIP sederhana.

Platform drama besar umumnya fokus pada episode panjang horizontal, sementara short-video apps tidak menyediakan pengalaman katalog drama yang rapi. Dramaplay mengisi celah tersebut.

---

## 5. Product Concept

Dramaplay menggunakan pendekatan **Hybrid: Home katalog + player swipe-style/seamless**.

### Home

Home menampilkan katalog terstruktur:

- Hero Banner / Featured Drama,
- Continue Watching,
- Trending Now,
- Recommended For You,
- New Release,
- Popular VIP,
- Top Free,
- Genre,
- Negara,
- Koleksi tematik.

### Detail Drama

Halaman detail menampilkan:

- poster/hero image,
- judul,
- sinopsis,
- genre,
- negara,
- tahun,
- jumlah episode,
- rating,
- status Free/VIP per episode,
- CTA mulai menonton atau lanjutkan.

### Player

Player dibuat untuk short drama vertikal:

- fullscreen/hampir fullscreen,
- auto-next episode,
- next/previous episode,
- subtitle Indonesia default aktif,
- resume progress,
- share episode,
- like,
- report issue,
- paywall saat episode VIP dibuka oleh user non-VIP.

---

## 6. MVP Goals

MVP Dramaplay berfokus pada **fondasi bisnis dan monetisasi**.

Tujuan utama:

1. Menyediakan pengalaman streaming short drama vertikal yang stabil di mobile.
2. Menyatukan katalog besar dari berbagai provider API.
3. Menjalankan model Freemium + VIP subscription.
4. Mengaktifkan pembayaran melalui Pakasir.
5. Memiliki admin panel lengkap untuk operasi katalog, provider, payment, user, dan konten.
6. Menyediakan data analytics untuk mengukur engagement dan conversion.
7. Menyiapkan deployment efisien di Cloudflare Pages + Workers.

---

## 7. Content Definition

Short drama Dramaplay didefinisikan sebagai:

- episode berdurasi 1–5 menit,
- format utama vertikal,
- cocok untuk konsumsi mobile satu tangan,
- cerita episodik dengan cliffhanger,
- ideal untuk binge watching ringan.

Konten tanpa subtitle Indonesia tetap bisa tayang, tetapi tidak diprioritaskan di Home/Featured.

---

## 8. Monetization Model

### Primary Model

**Subscription/VIP-first.**

Dramaplay menggunakan struktur:

- episode awal gratis,
- episode lanjutan VIP,
- user perlu subscription aktif untuk menonton episode VIP.

### VIP Structure

**Freemium + VIP.**

- Semua user bisa browse katalog.
- Semua user bisa menonton episode Free.
- Episode VIP hanya bisa ditonton oleh user dengan subscription aktif.
- Jumlah episode gratis fleksibel per judul.

### VIP Packages

| Package | Duration | Purpose |
|---|---:|---|
| VIP Mingguan | 7 hari | Entry point murah untuk pengguna baru |
| VIP Bulanan | 30 hari | Paket utama dengan value lebih baik |

Benefit sama untuk semua paket. Perbedaan hanya durasi.

### Auto-Renewal

Auto-renewal tidak wajib untuk MVP. Subscription bersifat manual renewal.

---

## 9. Payment Flow with Pakasir

Dramaplay menggunakan **Pakasir** sebagai payment gateway MVP.

### Flow

```text
User membuka episode VIP
→ sistem menampilkan paywall
→ user memilih paket VIP mingguan/bulanan
→ checkout Pakasir dibuat
→ user membayar
→ Pakasir mengirim callback/status pembayaran
→ Dramaplay memverifikasi callback
→ subscription user diaktifkan
→ user dikembalikan ke episode yang ingin ditonton
```

### Payment Status

Sistem harus menangani:

- pending,
- paid/success,
- failed,
- expired,
- callback gagal,
- manual reconcile/check status.

### Requirements

- Webhook Pakasir wajib diverifikasi.
- Payment event harus dicatat.
- Subscription entitlement hanya aktif setelah pembayaran valid.
- User dapat melihat riwayat pembayaran dan status subscription.
- Admin dapat memonitor transaksi, webhook log, dan melakukan reconcile manual.

---

## 10. Multi-Provider API Strategy

Dramaplay adalah platform provider-agnostic.

Provider API diasumsikan memiliki pola seperti:

- listing/foryou/homepage,
- trending/latest/VIP,
- search,
- detail,
- episode list,
- stream resolve/getvideo/decrypt.

### Provider Adapter Layer

Frontend tidak boleh langsung memanggil provider API.

Semua provider diakses melalui backend adapter:

- `DramaBoxAdapter`,
- `ReelShortAdapter`,
- `ShortMaxAdapter`,
- `GoodShortAdapter`,
- `PineDramaAdapter`,
- `FreeReelsAdapter`,
- provider lain di masa depan.

Adapter bertugas:

- mengambil listing,
- mengambil detail drama,
- mengambil episode,
- resolve stream URL,
- normalisasi metadata,
- menangani error,
- mencatat health provider.

### Access Control

Status Free/VIP di Dramaplay adalah aturan bisnis Dramaplay, bukan selalu mengikuti label provider.

Provider boleh memiliki label VIP, tetapi Dramaplay tetap menentukan access policy internal per episode.

---

## 11. Ingestion Strategy

Dramaplay menggunakan pendekatan **Hybrid ingestion**:

```text
Metadata katalog disinkronkan dan dicache ke database Dramaplay.
Stream URL episode di-resolve live saat user menekan play.
```

### Metadata Sync

Data yang disimpan:

- drama,
- episode,
- poster,
- thumbnail,
- genre,
- tag,
- negara,
- sinopsis,
- subtitle metadata,
- provider source mapping,
- availability status,
- provider health,
- Free/VIP override.

### Stream Live Resolve

Saat user menekan play:

```text
API cek akses Free/VIP
→ resolve stream URL via provider adapter
→ return source ke player
→ catat playback event
```

Stream URL tidak disimpan permanen. Cache sementara dengan TTL pendek diperbolehkan.

---

## 12. Catalog, Discovery, and Search

Katalog Dramaplay besar, dinamis, dan multi-provider. MVP tidak dikunci pada jumlah drama spesifik.

### Discovery Approach

**Hybrid editorial + algorithmic ranking.**

Editorial:

- hero banner,
- featured drama,
- koleksi tematik,
- promo VIP,
- manual priority.

Algorithmic:

- trending,
- popular,
- recommended,
- top free,
- top VIP,
- new release.

MVP dapat memakai rule-based ranking:

- views 24 jam/7 hari,
- completion rate,
- rating,
- like,
- favorite,
- share,
- watch time,
- provider availability,
- subtitle availability.

### Search & Filter

Minimum:

- search judul,
- genre,
- tag,
- negara,
- status Free/VIP,
- sort terbaru,
- sort trending,
- sort popular,
- sort rating tertinggi.

---

## 13. Deduplikasi Content

Karena multi-provider, drama yang sama bisa muncul dari beberapa sumber.

Dramaplay perlu deduplikasi berdasarkan:

- judul,
- judul alternatif,
- poster,
- jumlah episode,
- negara,
- genre,
- durasi,
- metadata lain,
- manual merge oleh admin.

Jika drama sama tersedia dari beberapa provider, Dramaplay dapat menentukan:

- primary source,
- fallback source,
- source dengan subtitle terbaik,
- source dengan playback paling stabil.

---

## 14. Subtitle Strategy

Dramaplay memakai strategi **provider subtitle + fallback internal**.

```text
Subtitle provider valid
→ pakai provider subtitle

Subtitle provider tidak tersedia/rusak/tidak sinkron
→ pakai subtitle internal jika tersedia

Tidak ada subtitle Indonesia
→ episode tetap bisa tayang, tetapi diberi flag dan tidak diprioritaskan
```

### Requirements

- Bahasa default: Indonesia.
- Format utama: WebVTT `.vtt`.
- Format fallback: SRT `.srt`, dikonversi ke VTT jika perlu.
- Subtitle default aktif.
- Admin bisa upload/override subtitle.
- Konten tanpa subtitle Indonesia diberi flag.

---

## 15. Video Player Requirements

Video player MVP menggunakan:

- **Video.js + HLS.js**.

Alasan:

- lebih mature,
- lebih aman untuk mobile browser,
- mendukung HLS/m3u8,
- lebih stabil untuk Android browser dan iOS Safari,
- mudah dikustomisasi untuk vertical short drama.

### Player Requirements

- mobile-first vertical layout,
- HLS/m3u8 support,
- subtitle Indonesia,
- auto-next episode,
- next/previous,
- resume progress,
- fullscreen behavior,
- playback error handling,
- report issue,
- paywall integration,
- share episode,
- lightweight enough for mobile.

---

## 16. User Account and Auth

Auth menggunakan **Supabase Auth**.

### MVP Login Methods

- email + password,
- Google login.

Roadmap:

- WhatsApp/SMS OTP,
- Apple login saat iOS dirilis.

### Anonymous Access

User tanpa login dapat:

- membuka Home,
- browse katalog,
- search,
- melihat detail drama,
- menonton episode Free jika policy mengizinkan.

Login diperlukan untuk:

- subscribe VIP,
- membuka episode VIP,
- favorite/bookmark,
- like,
- rating,
- watch history,
- continue watching,
- report issue,
- payment history.

---

## 17. Engagement Features

Masuk MVP:

- favorite/bookmark drama,
- like episode,
- rating drama,
- share drama/episode,
- deep link,
- watch history,
- continue watching,
- report issue.

Tidak masuk MVP:

- komentar,
- review panjang,
- forum/community.

Komentar masuk roadmap karena memerlukan moderasi spam/toxic yang lebih besar.

---

## 18. Report Issue Flow

User dapat melaporkan:

- video tidak bisa diputar,
- buffering/rusak,
- subtitle tidak tersedia,
- subtitle tidak sinkron,
- episode salah urutan,
- metadata salah,
- poster/thumbnail rusak,
- konten tidak sesuai,
- akses VIP bermasalah,
- pembayaran berhasil tetapi VIP belum aktif.

Report masuk ke admin panel sebagai operational queue.

---

## 19. Admin Panel Scope

Dramaplay MVP memiliki **full admin panel** sebagai project terpisah.

### Deployment

| App | Domain | Stack | Hosting |
|---|---|---|---|
| Consumer App | `dramaplay.id` | Vite + React + PWA | Cloudflare Pages |
| Admin Panel | `admin.dramaplay.id` | Vite + React | Cloudflare Pages |
| API | `api.dramaplay.id` | Cloudflare Workers | Cloudflare Workers |

### Admin Modules

1. Dashboard overview
2. Provider management
3. Catalog/drama management
4. Episode management
5. Subtitle management
6. Editorial/discovery management
7. Subscription/VIP management
8. Payment/Pakasir management
9. User management
10. Report management
11. Sync & maintenance
12. Basic analytics
13. System settings
14. Audit log

### Admin Roles

| Role | Access |
|---|---|
| Super Admin | Semua akses |
| Editor | Katalog, episode, subtitle, editorial |
| Moderator | Report dan user moderation terbatas |
| Finance | Payment, subscription, Pakasir, revenue |
| Support | User lookup, status VIP, payment support |

---

## 20. Technical Architecture

### Final Stack

| Layer | Technology |
|---|---|
| Consumer Frontend | Vite + React + PWA |
| Admin Frontend | Vite + React |
| Hosting | Cloudflare Pages |
| Backend/API | Cloudflare Workers |
| Database | Supabase PostgreSQL |
| ORM | Drizzle ORM |
| Auth | Supabase Auth |
| Payment | Pakasir |
| Video Player | Video.js + HLS.js |
| Android | Capacitor |
| CI/CD | GitHub Actions |
| Analytics | Internal events + Google Analytics/Plausible |

### Architecture Flow

```text
User
→ Cloudflare Pages Consumer PWA
→ Cloudflare Workers API
→ Supabase Auth / PostgreSQL via Drizzle
→ Provider Adapter Layer
→ Third-party Provider APIs
```

### Admin Flow

```text
Admin
→ Cloudflare Pages Admin Panel
→ Cloudflare Workers Admin API
→ Supabase Auth role check
→ Supabase PostgreSQL
```

---

## 21. Database and Data Model

Core entities:

- users/profile,
- admin roles,
- subscriptions,
- subscription plans,
- payments/transactions,
- dramas,
- episodes,
- provider sources,
- provider config,
- subtitle tracks,
- stream resolve cache,
- watch history,
- watch progress,
- favorites,
- likes,
- ratings,
- reports,
- editorial collections,
- banners,
- provider sync logs,
- provider health logs,
- analytics events,
- audit logs,
- notification state.

Database: Supabase PostgreSQL.  
ORM: Drizzle ORM.

---

## 22. Sync, Cache, and Provider Health

### Sync Strategy

Dramaplay memakai:

- Cloudflare Workers Cron,
- manual on-demand sync dari admin panel,
- GitHub Actions sebagai backup/maintenance trigger bila dibutuhkan.

### Sync Jobs

| Job | Frequency Initial |
|---|---:|
| Provider health check | 30–60 menit |
| Latest/new release | 1–3 jam |
| Trending/For You | 1–3 jam |
| Episode update active dramas | 6–12 jam |
| Full catalog resync | 24 jam |

### Sync Requirements

- batch kecil,
- pagination,
- rate limit per provider,
- retry,
- exponential backoff,
- sync log,
- manual retry,
- partial failure handling.

### Cache

Cache dapat digunakan untuk:

- Home sections,
- Trending,
- Featured,
- detail drama,
- episode list,
- popular search,
- provider health,
- stream resolve TTL pendek.

Stream URL tidak disimpan permanen.

---

## 23. Analytics and Event Tracking

Dramaplay menggunakan:

1. **Internal product analytics** untuk event bisnis dan engagement.
2. **Google Analytics atau Plausible** untuk traffic, page view, acquisition, dan growth.

### Internal Events MVP

- app open,
- page view internal,
- search performed,
- drama detail viewed,
- episode play started,
- episode progress,
- episode completed,
- auto-next triggered,
- playback error,
- subtitle toggled,
- favorite added/removed,
- like episode,
- rating submitted,
- share clicked,
- report submitted,
- paywall viewed,
- subscription plan selected,
- checkout created,
- payment pending,
- payment success,
- payment failed,
- VIP activated,
- login/register success.

### Metrics

- Free → VIP conversion,
- paywall conversion,
- payment success rate,
- active VIP users,
- revenue daily/monthly,
- watch time per user,
- episode completion rate,
- drama completion funnel,
- playback error rate,
- provider error rate,
- search-to-play conversion,
- retention indicators,
- top drama/episode,
- most reported content.

---

## 24. CI/CD with GitHub Actions

Dramaplay menggunakan GitHub Actions untuk CI/CD dan automation.

### Workflows

| Workflow | Purpose |
|---|---|
| `ci.yml` | lint, format, type-check, tests, build validation |
| `deploy-consumer.yml` | deploy consumer PWA ke Cloudflare Pages |
| `deploy-admin.yml` | deploy admin panel ke Cloudflare Pages |
| `deploy-api.yml` | deploy Workers API via Wrangler |
| `db-migrate.yml` | validate/run Drizzle migrations |
| `provider-sync.yml` | scheduled/manual provider sync trigger |
| `smoke-test.yml` | post-deploy endpoint checks |

### Environments

- Preview for PR/feature branch.
- Production for `main`.

### Secrets

Secrets disimpan di GitHub Secrets, bukan repository:

- `CLOUDFLARE_API_TOKEN`,
- `CLOUDFLARE_ACCOUNT_ID`,
- `SUPABASE_URL`,
- `SUPABASE_ANON_KEY`,
- `SUPABASE_SERVICE_ROLE_KEY`,
- `DATABASE_URL`,
- `PAKASIR_API_KEY`,
- `PAKASIR_WEBHOOK_SECRET`,
- provider API credentials,
- FCM credentials untuk Android nanti.

---

## 25. Android App via Capacitor

Android MVP memakai **Capacitor**.

```text
Vite + React + PWA
→ Capacitor Android App
→ Google Play Store
```

### Android MVP Features

- splash screen,
- app icon/adaptive icon,
- status bar customization,
- fullscreen immersive player,
- deep link/app link,
- native share intent,
- push notification ringan,
- network status detection.

### Roadmap Android

- offline download,
- picture-in-picture,
- Chromecast/casting,
- biometric login,
- advanced push segmentation.

### Payment Note

Android MVP menggunakan Pakasir checkout flow. Sebelum produksi penuh di Play Store, compliance Google Play payment policy harus divalidasi.

---

## 26. Security Requirements

Minimum security requirements:

- Supabase Auth untuk authentication,
- Workers token validation untuk protected API,
- role-based admin access,
- Pakasir webhook verification,
- no provider secrets in frontend,
- no payment secrets in frontend,
- admin audit log,
- payment audit trail,
- subscription entitlement checked server-side,
- rate limiting untuk auth/payment/report endpoints,
- validation for all input,
- secure CORS configuration,
- environment secrets managed securely,
- production logs must not expose tokens or payment secrets.

---

## 27. Success Metrics

### Business Metrics

- VIP conversion rate,
- weekly/monthly revenue,
- active VIP subscribers,
- payment success rate,
- subscription renewal rate,
- Free → VIP episode conversion.

### Engagement Metrics

- daily active users,
- watch time per user,
- episodes watched per session,
- episode completion rate,
- auto-next rate,
- favorite/bookmark rate,
- share rate,
- rating submission rate.

### Content Metrics

- top drama,
- top episodes,
- trending genres,
- search queries,
- provider content availability,
- subtitle availability,
- report rate per drama/provider.

### Technical Metrics

- playback error rate,
- provider API error rate,
- provider latency,
- sync success rate,
- API response time,
- payment webhook success rate,
- app load performance.

---

## 28. Risks and Mitigations

### Provider Reliability

Risk: provider API down, slow, rate-limited, or changes response format.  
Mitigation: adapter layer, caching, provider health monitoring, fallback source, admin disable provider.

### Legal and Licensing

Risk: provider content rights unclear.  
Mitigation: validate provider rights/contracts before full production launch.

### Playback Instability

Risk: stream URL expired or incompatible across mobile browsers.  
Mitigation: live resolve, Video.js + HLS.js, retry, error reporting, provider health logs.

### Payment Issues

Risk: callback missed or VIP not activated.  
Mitigation: webhook verification, transaction logs, manual reconcile, payment status polling/check endpoint.

### Scope Creep

Risk: MVP becomes too large due to full admin panel and multi-provider complexity.  
Mitigation: prioritize core flows first: catalog, player, VIP, Pakasir, provider sync, admin essentials.

### Cloudflare Free Limits

Risk: Workers/Pages limits affect sync or API usage.  
Mitigation: batch sync, cache, external scheduler backup, optimize requests, upgrade plan if needed.

---

## 29. Roadmap

### MVP

- Consumer PWA,
- Android via Capacitor,
- provider adapter layer,
- metadata sync,
- stream live resolve,
- Video.js + HLS.js player,
- Supabase Auth,
- Freemium + VIP,
- Pakasir payment,
- full admin panel,
- analytics internal + GA/Plausible,
- GitHub Actions CI/CD.

### Post-MVP

- comments and moderation,
- WhatsApp/SMS OTP,
- iOS app,
- coin unlock,
- rewarded ads,
- trial VIP,
- offline download,
- personalized ML recommendation,
- advanced cohort analytics,
- Play Store automation,
- subtitle editor,
- advanced deduplication tooling.

---

## 30. Out of Scope for MVP

- iOS native app,
- comments/community,
- coin system,
- rewarded ads unlock,
- recurring auto-renewal,
- offline downloads,
- Chromecast/casting,
- advanced ML recommendation,
- full legal/licensing automation,
- multi-language UI beyond Indonesian,
- complex A/B testing platform.

---

## 31. Open Questions

1. Domain final: `dramaplay.id` or alternative?
2. Final pricing for VIP weekly/monthly.
3. Exact Pakasir integration details: webhook signature, status API, payment methods.
4. Provider API contracts and legal status.
5. Whether Cloudflare KV is required from MVP or can be added after first performance pass.
6. Supabase storage vs Cloudflare R2 for internal subtitles/assets.
7. Final UI library for admin panel.
8. Google Analytics vs Plausible final choice.
9. Android Play Store compliance for Pakasir checkout.

---

## 32. Approval

This PRD reflects the agreed Dramaplay product direction and technical foundation. After approval, the next step is to create an implementation plan covering repository structure, schema design, API modules, frontend screens, admin modules, CI/CD workflows, and milestone breakdown.
