# Audit Implementasi: Pemutaran Video, Subtitle Indonesia, Fetch Cover

**Tanggal:** 2026-06-26 (direvisi + diverifikasi runtime via `.env.deploy`)

> **KOREKSI v2:** Versi awal menyatakan route `/stream` tidak ada handler. **SALAH** — `/stream` di-handle `apps/consumer/public/_worker.js` (terlewat saat grep `.ts`/`.tsx`).
>
> **VERIFIKASI v3 (runtime, token live):** Smoke + probe dijalankan terhadap `https://captain.sapimu.au`. Temuan A2, A5, B-subtitle, C-poster dikonfirmasi dengan data nyata (domain CDN, episode diff). Lihat tabel runtime di bawah.

**Cakupan:** API (`apps/api/src/`), Consumer (`apps/consumer/src/`), DB schema (`packages/db/`)
**File utama diaudit:** `routes/watch.ts`, `index.ts`, `providers/sapimu/base.ts`, `providers/sapimu.ts`, `providers/sapimu/goodshort.ts`, `sync/sync.ts`, `consumer/lib/playable.ts`, `consumer/lib/img.ts`, `consumer/components/VerticalShortPlayer.tsx`, `consumer/pages/Watch.tsx`, `db/schema/media.ts`, `db/schema/catalog.ts`

---

## A. Pemutaran Video

### ✅ A1 (DIKOREKSI). Route `/stream` ADA — di consumer Pages worker

`/stream` di-handle `apps/consumer/public/_worker.js:44` (Cloudflare Pages advanced mode, melayani `dramaplay.my.id`). Worker juga rewrite `/api/*` → `api.dramaplay.my.id`. Fungsinya lengkap:
- Allowlist domain CDN (`ALLOWED_STREAM_DOMAINS`) + SSRF guard (re-cek setelah redirect).
- Forward header `Range` (seeking MP4).
- Rewrite manifest m3u8 (segment & `URI="..."`) ke `/stream?u=ABS` pakai `new URL(ref, base)` (resolve relatif → absolut).
- Content-type fix: `.ts` → `video/mp2t`, manifest → `application/vnd.apple.mpegurl`.

**Alur yang benar:**
- Provider m3u8 absolute (dramawave/netshort/reelshort/pinedrama/melolo/goodshort/shortmax) → `playableUrl` → `/stream?u=ABS` → consumer `_worker.js` → ✅ **berfungsi** (jika domain ∈ allowlist).
- dramanova mp4 https → URL langsung → ✅ berfungsi.
- `/stream` tanpa prefix `/api` **memang benar**: di-serve consumer worker sendiri, bukan API worker.

### 🔴 A2 (TERVERIFIKASI RUNTIME). dramaboxbaru — segment 404

dramaboxbaru (`rawStream`):
1. `resolveStream` → `/proxy/sapimu-stream?path=%2Fdramaboxbaru%2Fapi%2Fstream%3FbookId%3D...`
2. `playableUrl` (`/proxy/` → `/api/proxy/...`) → consumer worker forward → manifest di-serve dari **`api.dramaplay.my.id/proxy/sapimu-stream`**.
3. Manifest asli (status 200) berisi segment **absolute** `https://hwzthls.dramaboxdb.com/...ts`. API worker (`index.ts:62`) rewrite → `/stream?u=https%3A%2F%2Fhwzthls.dramaboxdb.com%2F...` (path **relatif**).
4. hls.js minta `/stream` relatif ke origin manifest → **`api.dramaplay.my.id/stream`**.
5. **Diverifikasi:** `app.fetch("https://api.test/stream?u=...")` → **HTTP 404 Not Found**. API worker tidak punya `/stream` (hanya consumer worker punya).

→ **dramaboxbaru: manifest load, semua segment 404 → playback gagal total.** Bukti runtime, bukan dugaan.

**Fix:** rewrite di `index.ts` ke absolute `https://dramaplay.my.id/stream?u=...` (atau `CONSUMER_URL`), ATAU pindahkan rewrite ke consumer `_worker.js`, ATAU tambahkan handler `/stream` di API worker.

### 🔴 A3-stream. Codec handling benar
`base.ts:orderByPlayableCodec` menurunkan HEVC/H265 setelah H264 (Safari-only). `audit.ts` menandai `video_codec_not_browser_safe`. Implementasi benar.

### 🟢 A4. rawStream proxy benar konseptualnya
`/proxy/sapimu-stream` untuk dramaboxbaru benar konsep (rewrite `URI="..."` & segment same-origin) — hanya origin manifest-nya salah domain (A2).

### ✅ A5 (TERVERIFIKASI RUNTIME). Allowlist video CUKUP; subtitle 2 provider 403

Probe live menunjukkan **video** hanya lewat `/stream` jika `type=m3u8` (`playableUrl`: m3u8/http→proxy; `mp4`/`other` https → URL langsung). Semua provider m3u8 punya host ∈ allowlist:

| Provider | type | host video | lewat /stream? | allowlist | hasil |
|----------|------|-----------|----------------|-----------|-------|
| dramawave | m3u8 | video-v6.mydramawave.com | ya | ✅ | OK |
| reelshort | m3u8 | v-mps.crazymaplestudios.com | ya | ✅ | OK |
| goodshort | m3u8 | v2-akm.goodreels.com | ya | ✅ | OK |
| shortmax | m3u8 | akamai-static.shorttv.live | ya | ✅ | OK |
| dramanova | mp4 | sulao.montagehub.xyz | tidak (langsung) | — | OK |
| pinedrama | other | v31-sg.tiktokcdn.com | tidak (langsung) | — | hotlink* |
| netshort | other | awscdn.netshort.com | tidak (langsung) | — | hotlink* |
| melolo | other | tobrutmelolo.inicdn.net | tidak (langsung) | — | hotlink* + bug B-ep |
| dramaboxbaru | rawStream | dramaboxdb.com | ya (via API) | ✅ | 🔴 404 (A2) |

*type=other https di-play langsung via `<video src>` cross-origin — tidak kena allowlist, tapi rentan referer/CORS block (perlu verifikasi browser).

**Subtitle** lewat `/stream` untuk SEMUA host https (`subtitleProxyUrl`). Probe:
- dramawave subtitle `video-v6.mydramawave.com` → ✅ allowlist OK.
- **netshort** subtitle `awscdn.netshort.com` → 🔴 **tidak di allowlist → 403**.
- **pinedrama** subtitle `*.tiktokcdn.com` → 🔴 **tidak di allowlist → 403**.

**Fix:** tambah `netshort.com` & `tiktokcdn.com` ke `ALLOWED_STREAM_DOMAINS` (untuk subtitle netshort/pinedrama).

---

## B. Subtitle Indonesia

### 🔴 B1. Tabel `subtitles` TIDAK PERNAH diisi
`sync.ts` insert/update `dramas`, `episodes`, `episodeProviders`, `dramaProviders` — **tidak pernah insert ke `subtitles`**. Watch route (`watch.ts:57-62`) prioritize tabel `subtitles` (`language=id`, `isEnabled=true`) tapi **selalu miss** → fallback ke `source.subtitleUrl`.

Akibat: subtitle tidak di-cache/served dari DB; setiap play resolve subtitle on-the-fly dari provider.

### 🔴 B2 (TERVERIFIKASI RUNTIME). Banyak provider tidak return subtitle
Probe `resolveStream(ep1)` — field `subtitleUrl`:

| Provider | subtitleUrl? |
|----------|--------------|
| dramawave | ✅ ada (mydramawave.com) |
| netshort | ✅ ada (awscdn.netshort.com — tapi 403, lihat A5) |
| pinedrama | ✅ ada (tiktokcdn.com — tapi 403, lihat A5) |
| reelshort | ❌ none |
| dramanova | ❌ none |
| melolo | ❌ none |
| goodshort | ❌ none |
| shortmax | ❌ none |
| dramaboxbaru | ❌ none |

Penyebab kode:
- `SapimuProviderAdapter` (`sapimu.ts`, shortmax) & `GoodShortAdapter` (`goodshort.ts`) return `{streamUrl, streamType}` tanpa `subtitleUrl` (grep `subtitleUrl` → 0).
- Untuk batch1 (`createSapimuAdapter`), `findSubtitleUrl` hanya menemukan subtitle bila response play punya field `subtitle_list`/`subtitles`/dll — reelshort/dramanova/melolo/dramaboxbaru tidak menyertakannya → none.

**Hanya 3/9 provider (dramawave, netshort, pinedrama) yang punya subtitle**, dan 2 di antaranya (netshort, pinedrama) 403 karena allowlist. **Praktis hanya dramawave yang subtitle-nya berfungsi.**

### 🔴 B7 (TERVERIFIKASI RUNTIME). melolo — semua episode play video yang sama (episode 1)
Probe: `resolveStream(ep1).streamUrl === resolveStream(ep2).streamUrl` → **TRUE** untuk melolo (satu-satunya provider dengan `same_as_ep1=true`). Penyebab: `play: "/multi-video?id={id}&episode={ep}&lang=id"` — endpoint `/multi-video` mengabaikan `episode`, return semua video series; `findStreamUrl` ambil URL pertama → selalu episode 1. **Bug fungsional terkonfirmasi.** (Detail di `reports/audit-provider.md`.)

### 🟡 B3 (DIKOREKSI). Subtitle cross-origin tergantung allowlist
`subtitleProxyUrl` (`playable.ts:20`) proxy URL `http(s)://` ke `/stream?u=...` → consumer `_worker.js`. Subtitle **berfungsi** bila domain ∈ `ALLOWED_STREAM_DOMAINS`. Runtime: dramawave (`mydramawave.com`) OK; **netshort (`netshort.com`) & pinedrama (`tiktokcdn.com`) 403** (lihat A5).

### 🟡 B4. Format SRT vs WebVTT tidak divalidasi
`findSubtitleUrl` (`base.ts:108`) prefer field `vtt`/`vttUrl`, lalu fallback ke `url`/`subtitle`/`subtitleUrl`/`src`/`file`. Field fallback bisa berisi **SRT**, yang tidak dirender browser `<track kind="subtitles">` (butuh WebVTT). Tidak ada deteksi format / konversi SRT→VTT.

### 🟢 B5. pinedrama quirk implementasi benar
`base.ts:425-431`: video diambil dari `language=in` (H264), subtitle dari `language=id` (Indonesia) via fetch terpisah. Logikanya benar — hanya gagal di B3 (proxy `/stream`).

### 🟢 B6. `<track>` tag benar
`VerticalShortPlayer.tsx`: `<track src={subtitleUrl} kind="subtitles" srcLang="id" label="Indonesia" default />` — atribut benar.

---

## C. Fetch Cover / Poster

### 🟡 C1. `backdropUrl` tidak pernah di-persist
`sync.ts:83,94` hanya set `posterUrl` saat insert/update drama. `backdropUrl` (yang di-query catalog route `home`/`search`/`detail`) **selalu null**. Schema mendukung (`catalog.ts:36 backdropUrl: text("backdrop_url")`) tapi sync tidak mengisinya, dan adapter `rowToSummary` di `base.ts` juga tidak ekstrak backdrop (padahal `json-list.ts:36` punya `backdropUrl: row.backdropUrl ?? row.horizontalCover` — tapi itu branch dev, bukan sapimu).

### 🟡 C2 (TERVERIFIKASI RUNTIME). Cover hotlink rentan 403 (referer check)
`posterSrc` (`img.ts`) hanya proxy via wsrv.nl: `.heic` (melolo) + `tiktokcdn.com` (pinedrama). Cover lain hotlink langsung. Host poster runtime:

| Provider | host poster | proxied img.ts? |
|----------|-------------|-----------------|
| dramaboxbaru | thwztchapter.dramaboxdb.com | tidak (langsung) |
| dramawave | static-v1.mydramawave.com | tidak |
| pinedrama | p16-common-sign.tiktokcdn.com | ✅ wsrv |
| reelshort | v-img.crazymaplestudios.com | tidak |
| netshort | awscover.netshort.com | tidak |
| dramanova | aasleeimg.yfeitrade.com | tidak |
| melolo | p16-novel-sign.fizzopic.org | ✅ (.heic via wsrv) |
| goodshort | acfs1.goodreels.com | tidak |
| shortmax | akamai-static.shorttv.live | tidak |

Cover signed (`auth_key=...`, mis. shorttv.live) bisa kedaluwarsa; CDN dengan referer-check bisa 403 di consumer. Tidak ada fallback/validasi broken image di kartu.

### 🟡 C3. `audit.ts` ada tapi sync tidak menjalankannya
`audit.ts:assessProviderAudit` mengecek `poster_missing`, `video_codec_not_browser_safe`, `bad_media_content_type`. Tapi `sync.ts` tidak memanggilnya → poster kosong / codec berbahaya / content-type salah tidak terdeteksi & tidak ditandai (`dramas.isBroken` tidak pernah diset dari audit).

### 🟢 C4. `posterUrl` persist benar
`sync.ts` insert & update `posterUrl` dari `ProviderDramaSummary.posterUrl`. Adapter `base.ts:rowToSummary` ekstrak dari 16 varian field (`cover`, `poster`, `image`, `thumb`, dll) — cukup robust.

### 🟢 C5. `posterSrc` HEIC handling benar
Proxy HEIC ke wsrv.nl → webp (mobile WebView tak suka HEIC signed). Tapi `width=540` hardcode — tidak ada srcset responsif.

---

## D. Ringkasan severitas (terverifikasi runtime)

### 🔴 Critical (blok produksi)
1. **A2** — dramaboxbaru segment **404** (terbukti: API domain tak punya `/stream`). Playback dramabox gagal total.
2. **B7** — melolo semua episode play video episode 1 (terbukti: `same_as_ep1=true`).
3. **B1** — tabel `subtitles` tidak pernah diisi sync.
4. **B2** — hanya 3/9 provider return subtitle; efektif **hanya dramawave** yang subtitle-nya jalan.
5. **A5/B3** — subtitle netshort & pinedrama **403** (domain tak di allowlist).

### 🟡 Perlu perbaikan
6. **B4** — subtitle SRT vs VTT tidak divalidasi.
7. **C1** — `backdropUrl` tidak di-persist; catalog selalu null.
8. **C2** — cover hotlink rentan 403 (signed/referer); tidak ada fallback.
9. **C3** — `audit.ts` tidak dipanggil sync.
10. **A5-video** — pinedrama/netshort/melolo play `type=other` hotlink langsung (cross-origin); verifikasi referer/CORS di browser.

### ✅ Sudah benar (terverifikasi)
- **A1** `/stream` proxy ADA & robust di `_worker.js`.
- Video m3u8 (dramawave/reelshort/goodshort/shortmax) host ∈ allowlist → OK.
- dramanova mp4 langsung OK.
- A3 codec ordering. B5 pinedrama locale quirk. B6 `<track>` atribut. C4 `posterUrl` persist. C5 HEIC→webp.

---

## E. Rekomendasi urutan perbaikan

1. **Fix A2 (dramaboxbaru segment)** — di `index.ts:62` rewrite ke absolute consumer origin: `https://dramaplay.my.id/stream?u=...` (pakai `CONSUMER_URL`), ATAU pindahkan rewrite ke `_worker.js`. Quick win, buka dramabox.
2. **Fix B7 (melolo episode)** — filter video by episode di `resolveStream`/config (lihat audit-provider.md), atau ganti endpoint `/multi-video` ke per-episode.
3. **Tambah domain ke allowlist** (`_worker.js`): `netshort.com`, `tiktokcdn.com` — perbaiki subtitle netshort/pinedrama.
4. **Persist subtitle di `sync.ts`** (B1): ekstrak `subtitleUrl`, insert ke `subtitles` (`language=id`, `format=vtt/srt`).
5. **Tambah subtitle ke shortmax & goodshort** (B2): `findSubtitleUrl` di `resolveStream` (jika provider menyediakan).
6. **Validasi VTT/SRT** (B4): konversi SRT→VTT atau proxy.
7. **Persist `backdropUrl`** (C1) + **jalankan `audit.ts` di sync** (C3) + **cover proxy fallback** (C2).

---

## F. Bukti runtime (live, token `.env.deploy`)

- Smoke `smoke-sapimu-providers.ts`: 7/8 batch1 lulus gate dasar; shortmax 502 transient (probe terpisah 60 eps OK).
- Probe domain CDN per provider (tabel A5) + episode-diff (B7 melolo `same_as_ep1=true`).
- dramaboxbaru manifest: status 200, segment absolute `https://hwzthls.dramaboxdb.com/...ts`.
- `app.fetch("https://api.test/stream?u=...")` → **404 Not Found** (API worker tak punya `/stream`) → A2 terbukti.
- `subtitles` insert: 0 (hanya CREATE TABLE migration + schema + `<track>`).
- shortmax/goodshort `grep -c subtitleUrl` → 0.
- `backdropUrl` write ke kolom DB: 0 di `sync.ts`.
