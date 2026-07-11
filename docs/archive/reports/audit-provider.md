# Audit & Verifikasi Provider Drama

**Tanggal:** 2026-06-26
**Sumber verifikasi:** `docs/curl-endpoint/` (7 file) + `docs/providers/sapimu-scrape/docs-endpoints.json` (43 provider scrape, untuk cross-check shortmax & melolo yang tidak ada di curl-endpoint)
**Cakupan:** 9 provider ter-register di `apps/api/src/providers/registry.ts`

---

## 1. Arsitektur & inventaris provider

9 provider ter-register, 2 arsitektur adapter:

| # | Provider | File adapter | Tipe | Ada di `docs/curl-endpoint/`? |
|---|----------|--------------|------|------------------------------|
| 1 | shortmax | `providers/sapimu.ts` | `SapimuProviderAdapter` (hardcoded) | ❌ tidak |
| 2 | goodshort | `providers/sapimu/goodshort.ts` | `GoodShortAdapter` (dedicated) | ✅ |
| 3 | dramawave | `providers/sapimu/batch1.ts` | `createSapimuAdapter` (config) | ✅ |
| 4 | dramaboxbaru | `batch1.ts` | config | ✅ |
| 5 | dramanova | `batch1.ts` | config | ✅ |
| 6 | netshort | `batch1.ts` | config | ✅ |
| 7 | pinedrama | `batch1.ts` | config | ✅ |
| 8 | reelshort | `batch1.ts` | config | ✅ |
| 9 | melolo | `batch1.ts` | config | ❌ tidak |

Cabang `JsonListProviderAdapter` di `registry.ts` (dramabox/reelshort/shortmax) adalah fallback dev ketika `PROVIDER_API_TOKEN` kosong — bukan provider produksi.

**Gap verifikasi:** shortmax & melolo tidak punya dokumen di `docs/curl-endpoint/`. Cross-check via `docs-endpoints.json`.

---

## 2. Verifikasi per provider (code vs dokumen)

### ✅ netshort — COCOK penuh
Semua 6 endpoint (feed/new/vip/search/detail/episode) + `lang=id_ID` persis sama dengan doc.

### ✅ reelshort — COCOK penuh
foryou/new/completed/romance/drama/feed/42954/search/book/chapters/chapter/video cocok. `episodePlayField: ["chapter_id"]` benar (doc pakai chapter id `4m4o6mh49t`, bukan nomor episode).

### ✅ dramanova — COCOK
`/dramas`, `/drama/{id}`, `/video?id={fileId}`, `/search` cocok. `episodePlayField: ["fileId"]` benar (doc: `/api/video?id=v1830bg0...` = fileId). `vip` pakai `page=2` (tak terdokumentasi tapi wajar). Endpoint `/modules` & `/recommend` di doc tak dipakai (opsional).

### ⚠️ dramawave — Cocok, 2 penyimpangan kecil
- `feed/popular` doc pakai `?page=1&lang=id-ID`, code hilangkan `page=1` (default, OK).
- `search` code tambah `&lang=id-ID`; scrape konfirmasi search hanya terima `q`+`limit` (param `lang` diabaikan). `limit=10` dari doc tak dipakai.
- `feed/vip` & `feed/recommend` (foryou) **tidak ada di curl-endpoint doc**, tapi scrape konfirmasi keduanya tab valid (`feed/:tab` tab list termasuk `vip` & `recommend`). Aman.

### ⚠️ goodshort — Penyimpangan disengaja (terdokumentasi)
- `home` code `pageSize=50` vs doc `12` (ambil lebih banyak, OK).
- **`/play` endpoint TIDAK dipakai.** Komentar code: `/play` return URL `acfs1.goodreels.com` yang diblok dari IP range Cloudflare Workers; code pakai `/chapters` yang beri URL `v3-akm.goodreels.com` bertoken. Deviasi disengaja & masuk akal.
- Endpoint `/unlock`, `/segments`, `/key` (decryption) di doc tak dipakai. **Catatan:** kalau ada konten goodshort yang ter-encrypt, `/key`+`/segments` mungkin diperlukan — belum diuji.

### 🐛 dramaboxbaru — `type=0` pada `/browse`
- home/rank/recommend/hidden-gems/search/drama/stream cocok, `rawStream: true` benar (doc: `/stream` return HLS m3u8).
- **`/api/browse?lang=in&type=0&page=N`** — doc contoh pakai `type=534` (id kategori konkret). Code pakai `type=0` lalu loop 15 halaman (`page=1..15`) dimasukkan ke `vip`+`extra`. `type=0` tidak terdokumentasi sebagai nilai valid; bisa jadi return kosong / semua kategori. Plus 15 request paralel per `fetchVip()` berat. **Perlu verifikasi: apakah `type=0` return data?** Kalau tidak, ganti ke daftar `type` nyata dari `/api/categories`.

### 🟡 pinedrama — param `lang` salah nama pada 5 endpoint (search-family)
- `detail` & `play` **benar**: `language=id&region=ID` (play pakai `language=in` untuk H264 — quirk terdokumentasi di code).
- **`search`/`trending`/`latest`/`vip`/`foryou` pakai `?keyword=...&lang=id`** — doc & scrape konfirmasi `/api/drama/search` terima `keyword`+`language`+`region`, **bukan `lang`**. Param `lang` kemungkinan diabaikan API. Komentar code (sadar) sudah pakai keyword Indonesia (`cinta`/`suami`/`ceo`) sebagai workaround katalog karena "lang=id alone does not translate content" — jadi konten tetap Indonesia via keyword. **Namun param `lang` tetap salah nama**; sebaiknya diselaraskan ke `language=id&region=ID` agar konsisten dengan detail/play dan tidak bergantung perilaku undefined.
- Endpoint `/api/drama/episodes` ada di doc tapi code tak pakai (turunkan episode dari detail). `/api/drama/center` (home feed asli) tak dipakai — katalog di-emulasi via search keyword (workaround sadar, bukan API resmi).

### 🐛 melolo — 2 BUG (verifikasi via scrape, tidak ada di curl-endpoint)
- **`/bookmall?tab=0&lang=id`** — scrape: `/api/v1/bookmall` hanya terima `lang` (tidak ada `tab`). Endpoint tab sebenarnya `/bookmall/tabs?gender=...`. `tab=0` diabaikan.
- **`resolveStream` mengabaikan episode yang diminta.** Code: `play: "/multi-video?id={id}&episode={ep}&lang=id"`. Scrape: `/api/v1/multi-video` hanya terima `id`+`lang` (return SEMUA video series, cache 30 min) — `episode` diabaikan. Lalu `findStreamUrl(data)` return URL pertama yang ditemukan. **Hasil: play episode berapa pun selalu return video episode pertama.** Bug fungsional.

### ✅ shortmax — (verifikasi via scrape, tidak ada di curl-endpoint)
Semua endpoint code (`/feed/ranked`, `/feed/new`, `/feed/vip`, `/search?page=1`, `/detail/{code}`, `/play/{code}?ep=`) cocok scrape.

---

## 3. Ringkasan temuan berdasarkan severitas

### 🔴 Bug fungsional (harus diperbaiki)
1. **melolo `resolveStream` selalu play episode 1** — `multi-video` return semua video, `findStreamUrl` ambil yg pertama, `episode` param diabaikan (scrape: `/multi-video` hanya terima `id`+`lang`). Perlu filter video berdasarkan episode number/id dari response.
2. **pinedrama 5 endpoint pakai param `lang=id` (salah nama)** — harus `language=id&region=ID`. (Konten sudah Indonesia via keyword workaround, tapi param tetap perlu diselaraskan.)

### 🟡 Perlu verifikasi/berisiko
3. **dramaboxbaru `browse?type=0`** — nilai `type=0` tidak terdokumentasi; konfirmasi return data atau ganti ke id kategori dari `/categories`. Plus 15 request paralel per `fetchVip` = boros.
4. **goodshort** endpoint `/unlock`+`/key`+`/segments` tak dipakai — uji apakah ada konten ter-encrypt yang butuh decryption.

### 🟢 Penyimpangan kecil (harmless)
5. dramawave `search` tambah `lang=id-ID` (diabaikan API) & skip `limit=10`.
6. dramawave `feed/*` tanpa `page=1` (default).
7. pinedrama pakai search-by-keyword sebagai katalog (hack, bukan `/center`).

### ⚪ Gap dokumentasi
8. shortmax & melolo tidak ada di `docs/curl-endpoint/` — verifikasi hanya bisa via scrape. Sebaiknya tambahkan curl doc untuk konsistensi.

---

## 4. Lampiran: endpoint yang diverifikasi

Untuk setiap provider, code dicek terhadap dokumen curl-endpoint untuk: base URL, path, query param (lang/region/page), auth header, dan field mapping ID/title/poster/episodes/stream.

**Hasil:** 7/9 provider terverifikasi via `docs/curl-endpoint/`, 2/9 (shortmax, melolo) via scrape. Dua bug merah (melolo, pinedrama) dan satu risiko (dramaboxbaru type=0) ditemukan dari cross-check ini.
