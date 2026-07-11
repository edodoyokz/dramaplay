# Provider V2 Refactor Design

**Tanggal:** 2026-06-26  
**Status:** Draft — sudah diverifikasi terhadap codebase (lihat section Review)

## Review & Verifikasi (terhadap kode nyata)

Desain dicek terhadap file aktual. Ringkasan: **arah arsitektur valid**, tapi ada 6 ketidakcocokan teknis yang sudah dikoreksi di doc ini.

### 🔴 Koreksi wajib (salah vs kode)

1. **`ProviderStreamSource` tidak punya `subtitleFormat`.** Tipe nyata (`packages/shared/src/provider/types.ts`): `subtitleUrl?`, `subtitleLanguage?`, `quality?`, `expiresAt?`. Format subtitle hanya ada di **tabel** `subtitles.format`, bukan di provider source. Doc dikoreksi: deteksi format dilakukan saat sync sebelum insert, bukan field di `ProviderStreamSource`.
2. **Enum `subtitles.format` = `["vtt","srt","embedded"]`**, bukan `"unknown"`. Untuk subtitle yang formatnya tak jelas, pilihan: default ke `"srt"`/`"vtt"` via ekstensi URL, atau skip insert. `"embedded"` dipakai untuk hardsub bila nanti kita memang ingin mencatatnya.
3. **Enum `subtitles.source` = `["provider","internal"]`.** Doc sebelumnya menulis `source = providerCode` — itu salah, kolom ini bukan kode provider. Gunakan `source = "provider"`. Kode provider sudah tersimpan via relasi episode→provider.
4. **`ProviderEpisodeSummary` tidak punya `isVip`.** Field nyata: `providerEpisodeId`, `episodeNumber`, `title?`, `thumbnailUrl?`, `durationSeconds?`. VIP ditentukan di sync (threshold 10%, min 2), bukan dari provider. Hapus `isVip?` dari normalized model.
5. **`buildProviders(baseUrl, token)` tidak menerima `env`.** `SAPIMU_PROVIDER_ENGINE` flag butuh akses env, tapi registry sekarang tak punya. Di Cloudflare Worker tidak ada `process.env`. Jadi flag harus dilewatkan eksplisit: ubah signature jadi `buildProviders(baseUrl, token, opts?: { engine?: "v2" | "legacy" })`, dan caller (`watch.ts`, `sync.ts`, smoke) membaca `c.env.SAPIMU_PROVIDER_ENGINE`. Tambah `SAPIMU_PROVIDER_ENGINE` ke `Env` + `wrangler.toml`.
6. **Sync TIDAK memanggil `resolveStream` sama sekali saat ini.** Phase 3 "resolve stream untuk subtitle" bukan tweak — ini menambah **N panggilan `resolveStream` per drama** (mahal, rawan rate-limit, banyak URL signed yang expire). Lihat keputusan biaya di bawah.

### 🟡 Catatan akurasi

7. **Error handling item-level sekarang `catch {}` kosong** (`sync.ts`) — hanya `errorCount++`, **tanpa log**. Klaim doc "item bermasalah di-skip/log" belum benar; menambah log adalah pekerjaan baru, bukan kondisi eksisting.
8. **Watch tidak tahu `subtitlePolicy`.** `watch.ts` tidak punya akses policy provider, jadi aturan "hardsub → jangan tampilkan warning" perlu data tambahan dialirkan ke response watch (mis. `subtitleMode`). Belum ada sekarang.
9. **`backdropUrl` SUDAH ada di schema** (`catalog.ts: backdrop_url`) — valid, tinggal di-extract + persist. Tidak perlu migrasi schema.
10. **Watch subtitle query SUDAH benar** sesuai doc: `subtitles` (language=id, isEnabled) dulu lalu fallback `source.subtitleUrl`. Tidak perlu diubah, hanya perlu tabel diisi sync (B1).
11. **Helper bernama `pickString`/`pickNumber`, bukan `pickField`.** Doc dikoreksi memakai nama nyata.
12. **Tabel `subtitles` BELUM punya unique constraint** (`media.ts` tak ada `uniqueIndex`). "Upsert" subtitle butuh index unik `(episode_id, language, source)` dulu — kalau tidak, tiap sync menggandakan baris. Plan harus menambah migration index ini, atau pakai pola cek-lalu-insert.

### Keputusan biaya resolveStream saat sync (DIPUTUSKAN: B)

Karena sync belum pernah `resolveStream`, dan banyak provider mengembalikan URL signed yang expire, **keputusan: resolve subtitle hanya untuk episode gratis (free threshold) saat sync**. Subtitle episode VIP di-resolve on-demand saat watch lalu di-upsert ke `subtitles` (write-through). Sync tetap murah, tabel subtitle terisi untuk episode yang paling sering ditonton, VIP tetap ter-cache setelah ditonton sekali.

---

## Tujuan

Refactor provider system supaya lebih modular, robust, dan mudah ditambah provider baru. Target utama:

- Tambah provider baru cukup dengan membuat satu file provider.
- Quirk provider tidak bocor ke global adapter.
- Stream, subtitle, poster, dan backdrop punya pipeline yang jelas.
- Sync menyimpan metadata media yang penting, termasuk subtitle eksternal dan backdrop.
- Adapter lama tetap tersedia sementara sebagai fallback saat migrasi.

## Scope

Refactor ini mencakup:

1. Provider layer Sapimu v2.
2. Per-provider module file.
3. Override hooks untuk provider yang punya API shape khusus.
4. Subtitle policy: external, hardsub, mixed, unknown.
5. Persist subtitle eksternal ke tabel `subtitles`.
6. Persist `backdropUrl` saat sync.
7. Audit ringan untuk stream/subtitle/poster.
8. Hybrid migration: v2 berdampingan dengan legacy sementara.

Catatan scope provider: V2 mencakup **semua 9 provider di registry** yang memakai Sapimu/Captain API (`batch1` + `goodshort` + `shortmax`). Jadi `goodshort` dan `shortmax` ikut dipindah ke `sapimu/providers/*`, walaupun kode legacy-nya sekarang adapter terpisah.

Di luar scope awal:

- Cache/download subtitle ke R2 atau storage lain.
- Transcode video.
- Image cache sendiri.
- Dynamic plugin loader.
- Class custom untuk semua provider.

## Arsitektur File

Usulan struktur baru:

```txt
apps/api/src/providers/
  registry.ts

  sapimu/
    core/
      define.ts          # defineSapimuProvider()
      adapter.ts         # SapimuPresetAdapter generic
      extract.ts         # firstArray, findStreamUrl, findSubtitleUrl, field pickers
      http.ts            # Sapimu auth GET helper
      types.ts           # provider definition + override types
      media.ts           # streamType, subtitle format, poster/backdrop helpers

    providers/
      dramawave.ts
      dramaboxbaru.ts
      dramanova.ts
      netshort.ts
      pinedrama.ts
      reelshort.ts
      melolo.ts
      goodshort.ts
      shortmax.ts

    index.ts             # buildSapimuProviders()
    legacy.ts            # old adapter fallback wrapper, temporary
```

Provider registry tetap mengembalikan `Record<string, ProviderAdapter>`, jadi route dan consumer API tidak perlu tahu detail provider v2.

## Provider Definition

Provider normal cukup deklaratif:

```ts
export default defineSapimuProvider({
  code: "dramawave",
  endpoints: {
    trending: "/dramawave/api/v1/feed/popular?lang=id-ID",
    latest: "/dramawave/api/v1/feed/new?lang=id-ID",
    vip: "/dramawave/api/v1/feed/vip?lang=id-ID",
    foryou: "/dramawave/api/v1/feed/recommend?lang=id-ID",
    search: "/dramawave/api/v1/search?q={q}&lang=id-ID",
    detail: "/dramawave/api/v1/dramas/{id}?lang=id-ID",
    play: "/dramawave/api/v1/dramas/{id}/play/{ep}?lang=id-ID",
  },
  fields: {
    id: ["id", "book_id", "drama_id"],
    title: ["title", "name", "book_name"],
    poster: ["cover", "poster", "image"],
    backdrop: ["horizontalCover", "backdrop", "banner"],
    episodeNumber: ["episode", "index", "chapter_num"],
  },
  subtitlePolicy: "external",
});
```

Provider aneh pakai override kecil:

```ts
export default defineSapimuProvider({
  code: "melolo",
  endpoints: {
    trending: "/melolo/api/v1/bookmall?tab=0&lang=id",
    latest: "/melolo/api/v1/bookmall?tab=0&lang=id",
    vip: "/melolo/api/v1/bookmall?tab=0&lang=id",
    foryou: "/melolo/api/v1/bookmall?tab=0&lang=id",
    search: "/melolo/api/v1/search?q={q}&lang=id",
    detail: "/melolo/api/v1/series?id={id}&lang=id",
    play: "/melolo/api/v1/multi-video?id={id}&lang=id",
  },
  fields: {
    id: ["book_id"],
    title: ["book_name"],
    poster: ["thumb_url", "cover"],
    episodeNumber: ["index"],
  },
  subtitlePolicy: "hardsub",
  overrides: {
    selectStreamPayload(data, ctx) {
      return data.episodes?.find((e) => e.index === ctx.episodeNumber);
    },
  },
});
```

## Core Adapter

`SapimuPresetAdapter` implement `ProviderAdapter` dan memakai definition provider.

Tugas core adapter:

- Build endpoint path dari template `{id}`, `{ep}`, `{q}`.
- Jalankan HTTP GET dengan auth/header konsisten.
- Extract list/detail/episodes/stream memakai field mapping.
- Panggil override bila provider mendefinisikannya.
- Return normalized shared provider types.

Provider definition divalidasi saat test/startup:

- `code` wajib.
- `endpoints` minimal: `trending`, `latest`, `foryou`, `search`, `detail`, `play`.
- `fields` minimal: `id`, `title`, `poster`.
- `subtitlePolicy` wajib.

## Context Object (`ctx`)

Override menerima `ctx` dari core adapter, berisi:

```ts
interface SapimuCtx {
  code: string;
  get<T>(path: string): Promise<T>;   // HTTP GET dengan auth/header konsisten
  episodeId?: string;                 // saat resolveStream
  episodeNumber?: number;             // hasil parse dari providerEpisodeId
  fields: ResolvedFields;             // field mapping provider
}
```

`ProviderSubtitle` (tipe baru, didefinisikan di `core/types.ts`, BUKAN di shared):

```ts
interface ProviderSubtitle {
  url: string;
  language: string;                   // "id"
  format?: "vtt" | "srt";             // dideteksi dari URL bila bisa
}
```

## Override Hooks

Override yang disediakan:

```ts
overrides?: {
  extractList?(data, ctx): unknown[];
  extractDetail?(data, ctx): ProviderDramaDetail | Partial<ProviderDramaDetail> | undefined;
  extractEpisodes?(data, ctx): ProviderEpisodeSummary[] | undefined;
  selectStreamPayload?(data, ctx): unknown;
  normalizeStream?(data, ctx): ProviderStreamSource | undefined;
  extractSubtitle?(data, ctx): ProviderSubtitle | undefined;
}
```

Boundary:

- Override boleh transform data dan memilih payload.
- Override sebaiknya tidak membuat HTTP client sendiri.
- Kalau butuh request tambahan, gunakan `ctx.get()` supaya auth/header konsisten.
- Global helper tetap tersedia: `findStreamUrl`, `findSubtitleUrl`, `firstArray`, `pickString`, `pickNumber`, `streamTypeFromUrl`.

## Normalized Media Model

Provider v2 menghasilkan data normalized:

```ts
ProviderDramaSummary {
  providerDramaId: string;
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
  episodeCount?: number;
}

ProviderEpisodeSummary {
  providerEpisodeId: string;
  episodeNumber: number;
  title?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  // catatan: TIDAK ada isVip. VIP ditentukan sync (threshold), bukan provider.
}

ProviderStreamSource {
  streamUrl: string;
  streamType: "m3u8" | "mp4" | "other";
  subtitleUrl?: string;
  subtitleLanguage?: string;   // sesuai tipe nyata, BUKAN subtitleFormat
  quality?: string;
  expiresAt?: Date;
}
// Format subtitle (vtt/srt/embedded) dideteksi saat sync sebelum insert ke
// tabel `subtitles`, bukan disimpan di ProviderStreamSource.
```

## Subtitle Policy

Tidak semua provider punya subtitle eksternal. Beberapa video sudah hardsub. Karena itu provider punya policy:

```ts
type SubtitlePolicy = "external" | "hardsub" | "mixed" | "unknown";
```

Makna:

- `external`: provider biasanya menyediakan file subtitle terpisah.
- `hardsub`: subtitle Indonesia sudah terbakar di video; tidak ada `subtitleUrl` bukan error.
- `mixed`: sebagian episode/provider response punya subtitle eksternal, sebagian hardsub/tidak jelas.
- `unknown`: belum diketahui.

Runtime rule:

- Kalau `resolveStream` menemukan `subtitleUrl`, status episode dianggap `external`.
- Kalau tidak ada `subtitleUrl` dan policy `hardsub`, tidak dianggap error.
- Kalau policy `mixed`/`unknown`, audit warning ringan.
- Kalau policy `external` tapi subtitle hilang, audit warning lebih tinggi.

DB awal tetap hanya menyimpan subtitle eksternal ke tabel `subtitles`. Status hardsub cukup di provider config/audit dulu. Kolom DB untuk `subtitleMode` ditunda sampai UI/report butuh.

### Mapping policy awal (berdasarkan probe runtime B2)

| Provider | subtitleUrl di probe | Policy awal | Catatan |
|----------|----------------------|-------------|---------|
| dramawave | ✅ ada | `external` | satu-satunya subtitle yang terbukti jalan |
| netshort | ✅ ada | `external` | allowlist sudah di-fix (awscdn) |
| pinedrama | ✅ ada | `external` | subtitle id via `language=id`, allowlist fixed |
| melolo | ❌ none | `hardsub` | `/multi-video` tanpa field subtitle; **perlu konfirmasi visual** |
| reelshort | ❌ none | `unknown` | tak return subtitle |
| dramanova | ❌ none | `unknown` | mp4, tak return subtitle |
| dramaboxbaru | ❌ none | `unknown` | rawStream m3u8, tak ada field subtitle |
| goodshort | ❌ none | `unknown` | adapter tak ekstrak subtitle |
| shortmax | ❌ none | `unknown` | adapter tak ekstrak subtitle |

**Default konservatif:** provider tanpa subtitle = `unknown` (audit warning ringan, bukan error), kecuali melolo yang ditandai `hardsub` sementara. Begitu verifikasi visual selesai, `unknown` dipindah ke `hardsub` atau `external`. Open Question #1 diturunkan ke tabel ini.

## Sync Data Flow

Sync v2:

1. Fetch provider lists.
2. Upsert `dramas` dengan `posterUrl` dan `backdropUrl`.
3. Fetch detail dan episodes.
4. Upsert `episodes`, `episodeProviders`, `dramaProviders`.
5. Resolve stream **hanya untuk episode gratis** (free threshold) agar subtitle eksternal bisa ditemukan tanpa membebani sync. Episode VIP tidak di-resolve saat sync.
   - Sync TIDAK punya kolom `accessType` saat resolve (itu di-`UPDATE` belakangan). Jadi hitung threshold yang SAMA dengan logika existing: `threshold = max(2, ceil(total * 0.1))`, lalu resolve hanya episode dengan `episodeNumber <= threshold`. Threshold ini harus dipakai konsisten dengan blok free/vip di akhir loop.
6. Jika ada subtitle eksternal:
   - detect format dari ekstensi/isi URL: `vtt`, `srt`; bila tak jelas default `srt` atau skip insert (enum DB hanya `vtt`/`srt`/`embedded`, tidak ada `unknown`)
   - upsert ke `subtitles` dengan `language = "id"`, `source = "provider"`, `format = "vtt" | "srt" | "embedded"`, `isEnabled = true`
   - jika format `srt`, simpan untuk audit/cache tapi **jangan return ke `<track>`** sampai ada konversi SRT→VTT; browser butuh WebVTT
7. Jalankan audit ringan.

Write-through subtitle VIP: saat watch sebuah episode VIP berhasil resolve dan punya `subtitleUrl`, upsert ke `subtitles` (idempotent) supaya tontonan berikutnya membaca dari DB. Upsert hanya dilakukan jika DB belum punya subtitle aktif untuk `(episodeId, language=id, source=provider)` atau URL berubah.

Catatan biaya: sync sekarang **tidak** memanggil `resolveStream`. Resolve dibatasi ke episode gratis (keputusan B); episode VIP write-through saat watch (lihat section Review).

Sync tidak boleh gagal total hanya karena subtitle kosong atau poster buruk. Provider/item bermasalah di-skip. Catatan: `catch {}` item-level sekarang **tidak** logging — desain ini menambah log/warning per item (pekerjaan baru), supaya error tidak hilang diam-diam.

## Watch Data Flow

Watch route tetap sederhana:

1. Resolve episode/provider.
2. Ambil stream source dari cache/provider seperti sekarang.
3. Cek tabel `subtitles` untuk external subtitle aktif (`language = id`).
4. Kalau ada DB subtitle, pakai itu.
5. Kalau tidak ada, fallback ke `source.subtitleUrl` **hanya jika format tampak renderable (VTT atau URL tidak terdeteksi SRT). Jangan return SRT mentah ke `<track>` sampai ada converter.**
6. Jika fallback subtitle dipakai, write-through ke tabel `subtitles` bila belum ada/URL berubah.
7. Kalau tidak ada dan provider policy hardsub, tidak tampilkan warning subtitle.
8. Return `streamUrl`, `streamType`, `subtitleUrl?`, provider badge.

## Cover / Backdrop Policy

- `posterUrl`: cover vertikal utama, wajib diusahakan.
- `backdropUrl`: cover horizontal/banner, optional.
- Jangan generate backdrop palsu dari poster.
- Jika provider tidak punya backdrop, simpan null.
- `posterSrc` consumer tetap boleh proxy kasus khusus seperti `.heic` dan `tiktokcdn.com`.
- Cover hotlink yang sering 403 dicatat audit; image cache sendiri bukan scope awal.

## Media Audit

Audit ringan berjalan saat smoke/sync:

- stream kosong: error.
- poster kosong: warning.
- subtitle external hilang pada provider `external`: warning.
- subtitle format `srt`: warning; boleh disimpan, tapi tidak boleh dikirim ke `<track>` sampai dikonversi ke WebVTT.
- stream host tidak dikenal: warning/error sesuai allowlist.
- m3u8 content-type buruk: warning.
- HEVC/H265 dipilih padahal H264 tersedia: error.

Audit tidak memblokir seluruh sync kecuali stream kosong saat watch atau provider benar-benar tidak punya playable episode.

## Migration Strategy

Pakai hybrid migration.

### Phase 1 — Core v2 berdampingan

Buat `sapimu/core/*`, `sapimu/providers/*`, dan `sapimu/index.ts`. Legacy adapter tetap ada.

Registry sekarang `buildProviders(baseUrl, token)` dan tidak menerima env. Tambah parameter opsi:

```ts
buildProviders(baseUrl, token, { engine })  // engine: "v2" | "legacy"
```

Caller (`watch.ts`, `sync.ts`, smoke) membaca flag dari `c.env`/Env:

```txt
SAPIMU_PROVIDER_ENGINE=v2 | legacy
```

Tambahkan `SAPIMU_PROVIDER_ENGINE` ke `apps/api/src/env.ts` dan `wrangler.toml`. Cloudflare Worker tidak punya `process.env`, jadi flag harus dilewatkan eksplisit lewat parameter, bukan dibaca global.

### Phase 2 — Migrasi provider

Migrasi semua provider Sapimu ke file masing-masing:

- `dramawave.ts`
- `dramaboxbaru.ts`
- `dramanova.ts`
- `netshort.ts`
- `pinedrama.ts`
- `reelshort.ts`
- `melolo.ts`
- `goodshort.ts`
- `shortmax.ts`

Setiap file minimal punya:

- `code`
- `endpoints`
- `fields`
- `subtitlePolicy`
- `overrides?`

### Phase 3 — Sync upgrade

Prasyarat: tambah migration **unique index `subtitles (episode_id, language, source)`** supaya upsert idempotent (tabel sekarang tak punya constraint ini).

Upgrade sync untuk:

- persist `backdropUrl`
- resolve stream **hanya episode gratis** untuk subtitle eksternal (keputusan B)
- upsert tabel `subtitles` (butuh unique index di atas)
- write-through subtitle VIP saat watch
- jalankan audit ringan
- tambah log/warning di `catch {}` item-level (sekarang kosong)

### Phase 4 — Cutover

Jika smoke semua provider lolos:

- set `SAPIMU_PROVIDER_ENGINE=v2` di production
- simpan legacy selama satu rilis sebagai rollback
- setelah stabil, hapus legacy files (`batch1.ts`, `sapimu.ts` shortmax legacy, `sapimu/goodshort.ts`, old factory/base yang sudah tergantikan)

## Testing Plan

Minimal test:

1. Unit test extractor:
   - `firstArray`
   - `findStreamUrl`
   - `findSubtitleUrl`
   - `pickString` / `pickNumber`
   - subtitle format detection

2. Provider definition validation:
   - missing endpoint fail
   - missing field fail
   - missing subtitlePolicy fail

3. Provider regression:
   - dramaboxbaru rawStream rewrite absolute consumer `/stream`
   - melolo ep1 != ep2
   - pinedrama H264 video + Indonesian subtitle
   - netshort/pinedrama subtitle host allowed
   - dramanova mp4 recognized
   - reelshort chapter_id used as play param

4. Sync regression:
   - `posterUrl` persisted
   - `backdropUrl` persisted when available
   - external subtitle inserted into `subtitles` (episode gratis)
   - subtitle upsert idempotent — sync dua kali tidak menggandakan baris
   - resolve subtitle hanya untuk `episodeNumber <= max(2, ceil(total*0.1))`
   - hardsub provider without subtitle does not fail

5. Existing API tests tetap pass.

## Rollback Plan

- `SAPIMU_PROVIDER_ENGINE=legacy` mengaktifkan adapter lama.
- Legacy files tidak dihapus sampai v2 stabil satu rilis.
- Provider v2 bisa dimigrasi bertahap, tapi cutover production hanya setelah smoke semua provider lulus.

## Open Questions

1. Provider mana `hardsub` vs `unknown` perlu verifikasi **visual** (mapping awal sudah ada di section Subtitle Policy). Belum dikonfirmasi: melolo (sementara `hardsub`), reelshort/dramanova/dramaboxbaru/goodshort/shortmax (sementara `unknown`).
2. Berapa banyak episode yang di-resolve saat sync: **diputuskan B** — hanya episode gratis saat sync, VIP write-through saat watch.
3. Apakah UI perlu menampilkan status “hardsub”/“subtitle eksternal” nanti, atau cukup internal audit?
4. Kapan legacy boleh dihapus: setelah satu deploy stabil, atau setelah laporan smoke beberapa hari?

## Rekomendasi Implementasi

Urutan paling aman:

1. Tulis core v2 dan tests extractor/definition.
2. Migrasi provider satu per satu ke file modular.
3. Jalankan smoke live dan cocokkan hasil dengan legacy.
4. Upgrade sync subtitle/backdrop.
5. Enable v2 via env di production.
6. Setelah stabil, hapus legacy.
