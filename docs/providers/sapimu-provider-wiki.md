# Sapimu API Provider Wiki

**Source:** authenticated scrape from `https://captain.sapimu.au/docs` using `auth_token=<PROVIDER_API_TOKEN>` from `.env.deploy`.

**Scrape result:** 43 Active APIs, 339 endpoints reported by UI. Parsed docs contain 335 provider endpoints; remaining 4 are system/global endpoints shown on docs home.

> Raw artifacts: `docs/providers/sapimu-scrape/docs-index.html`, `docs/providers/sapimu-scrape/docs-*.html`, `docs/providers/sapimu-scrape/docs-endpoints.json`.

## Auth

Docs login shortcut used by site JS:

```http
Cookie: auth_token=<PROVIDER_API_TOKEN>
```

API calls use:

```http
Authorization: Bearer <PROVIDER_API_TOKEN>
User-Agent: Mozilla/5.0
```

## Provider index

| # | Provider | Base URL | Endpoints | Has detail/play-like endpoint? |
|---:|---|---|---:|---|
| 1 | `bilitv` | `https://captain.sapimu.au/bilitv` | 8 | ✅ |
| 2 | `cashdrama` | `https://captain.sapimu.au/cashdrama` | 9 | ✅ |
| 3 | `cubetv` | `https://captain.sapimu.au/cubetv` | 11 | ✅ |
| 4 | `dotdrama` | `https://captain.sapimu.au/dotdrama` | 4 | ⚠️ |
| 5 | `dramabite` | `https://captain.sapimu.au/dramabite` | 9 | ✅ |
| 6 | `dramaboxbaru` | `https://captain.sapimu.au/dramaboxbaru` | 10 | ✅ |
| 7 | `dramanova` | `https://captain.sapimu.au/dramanova` | 7 | ✅ |
| 8 | `dramapops` | `https://captain.sapimu.au/dramapops` | 9 | ✅ |
| 9 | `dramarush` | `https://captain.sapimu.au/dramarush` | 7 | ✅ |
| 10 | `dramawave` | `https://captain.sapimu.au/dramawave` | 5 | ✅ |
| 11 | `flextv` | `https://captain.sapimu.au/flextv` | 7 | ✅ |
| 12 | `flickshort` | `https://captain.sapimu.au/flickshort` | 5 | ✅ |
| 13 | `freereels` | `https://captain.sapimu.au/freereels` | 12 | ✅ |
| 14 | `fundrama` | `https://captain.sapimu.au/fundrama` | 6 | ✅ |
| 15 | `goodshort` | `https://captain.sapimu.au/goodshort` | 8 | ✅ |
| 16 | `hishort` | `https://captain.sapimu.au/hishort` | 4 | ✅ |
| 17 | `idrama` | `https://captain.sapimu.au/idrama` | 9 | ⚠️ |
| 18 | `melolo` | `https://captain.sapimu.au/melolo` | 8 | ✅ |
| 19 | `meloshort` | `https://captain.sapimu.au/meloshort` | 6 | ✅ |
| 20 | `microdrama` | `https://captain.sapimu.au/microdrama` | 4 | ⚠️ |
| 21 | `minutedrama` | `https://captain.sapimu.au/minutedrama` | 3 | ✅ |
| 22 | `moboreels` | `https://captain.sapimu.au/moboreels` | 10 | ✅ |
| 23 | `netshort` | `https://captain.sapimu.au/netshort` | 15 | ✅ |
| 24 | `pinedrama` | `https://captain.sapimu.au/pinedrama` | 7 | ✅ |
| 25 | `radreels` | `https://captain.sapimu.au/radreels` | 9 | ✅ |
| 26 | `rapidtv` | `https://captain.sapimu.au/rapidtv` | 4 | ✅ |
| 27 | `reelala` | `https://captain.sapimu.au/reelala` | 6 | ✅ |
| 28 | `reelife` | `https://captain.sapimu.au/reelife` | 8 | ✅ |
| 29 | `reelshort` | `https://captain.sapimu.au/reelshort` | 11 | ✅ |
| 30 | `sarostv` | `https://captain.sapimu.au/sarostv` | 7 | ✅ |
| 31 | `sereal` | `https://captain.sapimu.au/sereal` | 9 | ⚠️ |
| 32 | `shortbox` | `https://captain.sapimu.au/shortbox` | 10 | ✅ |
| 33 | `shorten` | `https://captain.sapimu.au/shorten` | 7 | ⚠️ |
| 34 | `shortmax` | `https://captain.sapimu.au/shortmax` | 13 | ✅ |
| 35 | `shortsky` | `https://captain.sapimu.au/shortsky` | 6 | ✅ |
| 36 | `shortwave` | `https://captain.sapimu.au/shortwave` | 8 | ✅ |
| 37 | `shotshort` | `https://captain.sapimu.au/shotshort` | 8 | ✅ |
| 38 | `snackshort` | `https://captain.sapimu.au/snackshort` | 7 | ✅ |
| 39 | `sodareels` | `https://captain.sapimu.au/sodareels` | 6 | ✅ |
| 40 | `stardusttv` | `https://captain.sapimu.au/stardusttv` | 7 | ✅ |
| 41 | `starshort` | `https://captain.sapimu.au/starshort` | 7 | ✅ |
| 42 | `velolo` | `https://captain.sapimu.au/velolo` | 7 | ✅ |
| 43 | `vigloo` | `https://captain.sapimu.au/vigloo` | 12 | ✅ |

## Full endpoint catalog

### bilitv

Base: `https://captain.sapimu.au/bilitv`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | List supported languages | - | - |
| GET | `/api/v1/home` | Homepage dramas | `page`=1, `limit`=20, `lang`=id | - |
| GET | `/api/v1/search` | Search drama | `q`*=love, `lang`=id | 100 |
| GET | `/api/v1/recommend` | Recommended dramas | `lang`=id | - |
| GET | `/api/v1/dramas` | Drama list | `lang`=id, `page`=1, `size`=20 | - |
| GET | `/api/v1/drama/:id` | Drama detail with episodes | `id`*=1881, `lang`=id | - |
| GET | `/api/v1/drama/:id/episode/:ep` | Episode video URL (480/720/1080) | `id`*=1881, `ep`*=15, `quality`=720 | - |
| GET | `/api/v1/subtitle/:shortId/:episode` | Episode subtitle with auto-translate | `shortId`*=1881, `episode`*=15, `lang`=id, `format`=json|vtt | - |

### cashdrama

Base: `https://captain.sapimu.au/cashdrama`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | Supported languages | - | - |
| GET | `/api/v1/home` | Home feed | `lang`=id, `page`=1, `pageSize`=20, `blockId`=5 | - |
| GET | `/api/v1/blocks` | Categories/blocks | `lang`=id | - |
| GET | `/api/v1/tags` | Tags list | `lang`=id | - |
| GET | `/api/v1/drama/:vid` | Drama detail | `vid`*=15201, `ep`=1, `lang`=id | - |
| GET | `/api/v1/drama/:vid/episodes` | Episode list | `vid`*=15201, `lang`=id | - |
| GET | `/api/v1/search` | Search drama | `q`*=love, `page`=1, `lang`=id | 100 |
| GET | `/api/v1/tags/search` | Search by tag | `tagId`*=15, `page`=1, `lang`=id | 100 |
| GET | `/api/v1/play/:vid/:ep` | Video URL (Tencent VOD) | `vid`*=15201, `ep`*=15, `lang`=id | - |

### cubetv

Base: `https://captain.sapimu.au/cubetv`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/languages` | List of 13 languages | - | - |
| GET | `/shows` | Katalog lengkap 999 drama | `page`=1, `pageSize`=20, `lang`=id | - |
| GET | `/home/recommendations` | Beranda / Rekomendasi | `lang`=id | - |
| GET | `/home/trending` | Baru & Trending | `lang`=id | - |
| GET | `/home/romance` | Emosi / Romance | `lang`=id | - |
| GET | `/home/shows` | Katalog Shows | `lang`=id | - |
| GET | `/coming-soon` | Drama segera hadir | `lang`=id | - |
| GET | `/search` | Browse / cari drama | `keyword`=a, `page`=1, `pageSize`=50, `moduleid`=PaEpZ7, `lang`=id | 100 |
| GET | `/search/:videoid/episodes` | Drama detail | `videoid`*=5ZMAoZ, `page`=1, `pageSize`=20, `lang`=id | 100 |
| GET | `/episode/:videoid/list` | List of all episodes | `videoid`*=5ZMAoZ, `lang`=id | - |
| GET | `/stream/:videoid/:episodeid` | URL Video M3U8 + subtitle | `videoid`*=5ZMAoZ, `episodeid`*=ax6pNv, `lang`=id | - |

### dotdrama

Base: `https://captain.sapimu.au/dotdrama`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/dramas` | Drama list | `page`=1, `limit`=50, `lang`=id | - |
| GET | `/api/v1/collections` | Collections (hot, for you, etc) | `lang`=id | - |
| GET | `/api/v1/categories` | Category list | `page`=1, `limit`=1000 | - |
| GET | `/api/v1/dramas/:id` | Drama detail + episodes with video URL | `id`*=2008052547485241345 | - |

### dramabite

Base: `https://captain.sapimu.au/dramabite`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | List supported languages | - | - |
| GET | `/api/v1/dramas` | Drama list | `lang`=id, `page`=0 | - |
| GET | `/api/v1/foryou` | For You recommendations | `lang`=id, `page`=0 | - |
| GET | `/api/v1/hot` | Hot/trending keywords | - | - |
| GET | `/api/v1/drama/:id` | Drama detail with episodes | `id`*=14923, `lang`=id | - |
| GET | `/api/v1/drama/:id/likes` | Drama like count | `id`*=14923, `lang`=id | - |
| GET | `/api/v1/drama/:id/episode/:ep` | Episode video URL | `id`*=14923, `ep`*=15, `lang`=id, `quality`=default | - |
| GET | `/api/v1/search` | Search drama (gRPC server-side) | `q`*=love, `lang`=id, `limit`=20 | 100 |
| GET | `/api/v1/recommend` | Homepage recommendations | `lang`=id, `page`=0 | - |

### dramaboxbaru

Base: `https://captain.sapimu.au/dramaboxbaru`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/languages` | Daftar bahasa | - | - |
| GET | `/api/home` | Home/discovery (banners + sections) | `lang`=en | - |
| GET | `/api/rank` | Trending/ranking | `lang`=en | - |
| GET | `/api/recommend/book` | Must-sees/rekomendasi | `lang`=en | - |
| GET | `/api/hidden-gems` | Hidden gems | `lang`=en | - |
| GET | `/api/categories` | Daftar kategori/genre | `lang`=en | - |
| GET | `/api/browse` | Browse per kategori | `lang`=en, `type`=534, `page`=1 | - |
| GET | `/api/search` | Cari drama | `keyword`*=love, `lang`=en | 100 |
| GET | `/api/drama/:bookId` | Detail drama + daftar episode | `bookId`*=42000010883, `lang`=en | - |
| GET | `/api/stream` | HLS m3u8 stream | `bookId`*=42000010883, `episode`*=1, `lang`=en | - |

### dramanova

Base: `https://captain.sapimu.au/dramanova`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | List supported languages | - | - |
| GET | `/api/v1/dramas` | Drama list | `lang`=in, `page`=1, `size`=20 | - |
| GET | `/api/v1/drama/:id` | Drama detail with episodes | `id`*=2016071217226772480, `lang`=in | - |
| GET | `/api/video` | Get video streaming URL using fileId obtained from drama episodes in /api/v1/drama/:id response | `id`*=v1830bg00000d5tg6fn3ksl47jhrvcj0 | - |
| GET | `/api/v1/search` | Search drama (202 dramas) | `q`*=love, `lang`=in | 100 |
| GET | `/api/v1/modules` | List all recommendation categories | `lang`=in | - |
| GET | `/api/v1/recommend` | Recommended dramas by category (17 categories). Use categoryKey to get specific category | `lang`=in, `categoryKey`=dramanova_hot, `page`=1, `size`=5, `limit`=6 | - |

### dramapops

Base: `https://captain.sapimu.au/dramapops`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | List supported languages | - | - |
| GET | `/api/v1/config` | App config (homepage layout, movies order) | - | - |
| GET | `/api/v1/homepage` | Homepage sections with movies | - | - |
| GET | `/api/v1/dramas` | Drama list | `limit`=20, `lang`=id | - |
| GET | `/api/v1/dramas/trending` | Trending dramas (by watch count) | `limit`=20, `lang`=id | - |
| GET | `/api/v1/dramas/popular` | Popular dramas (by added to list) | `limit`=20, `lang`=id | - |
| GET | `/api/v1/drama/:id` | Drama detail | `id`*=act_like_you_love_me, `lang`=id | - |
| GET | `/api/v1/drama/:id/episode/:ep/video` | Episode video URL (multi-quality) | `id`*=24622, `ep`*=1, `lang`=id, `quality`=720p | - |
| GET | `/api/v1/search` | Search drama | `q`*=love, `limit`=20, `lang`=id | 100 |

### dramarush

Base: `https://captain.sapimu.au/dramarush`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/config` | App config | `lang`=id | - |
| GET | `/api/v1/ranking` | Search ranking | `lang`=id | - |
| GET | `/api/v1/tabs/:id` | Tab home data | `id`*=0, `lang`=id | - |
| GET | `/api/v1/drama/:id` | Drama detail | `id`*=12094, `lang`=id | - |
| GET | `/api/v1/search/:q` | Search drama | `q`*=love, `lang`=id | 100 |
| GET | `/api/v1/play/:id` | Get episodes with video URLs (paginated) | `id`*=12094, `page`=1, `size`=20, `lang`=id | - |
| GET | `/api/v1/play/:id/:ep` | Get single episode video URL | `id`*=12094, `ep`*=15, `lang`=id | - |

### dramawave

Base: `https://captain.sapimu.au/dramawave`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/feed/:tab` | Feed by tab (popular/free/female/new/male/vip/exclusive/dubbing/coming-soon/recommend) | `tab`*=popular, `page`=1, `lang`=id-ID | - |
| GET | `/api/v1/search` | Search drama | `q`*=love, `limit`=10 | 100 |
| GET | `/api/v1/dramas/:id` | Drama detail with episodes | `id`*=quv2y2O9gA, `lang`=id-ID | - |
| GET | `/api/v1/dramas/:id/play/:ep` | Episode video URL | `id`*=quv2y2O9gA, `ep`*=15, `lang`=id-ID | 100 |
| GET | `/api/v1/languages` | Supported languages (20 languages) | - | - |

### flextv

Base: `https://captain.sapimu.au/flextv`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | List supported languages | - | - |
| GET | `/api/v1/tabs` | Get tabs/categories | `lang`=id | - |
| GET | `/api/v1/tabs/:id` | Get dramas by tab (id: 1=Popular/Fokus, 2=New/Baru, 3=Chart/Peringkat, 6=Original+, 7=For Her/Wanita, 8=For Him/Pria, 11=Anime) | `id`*=1, `page`=1, `lang`=id | - |
| GET | `/api/v1/search` | Search dramas | `q`*=love, `page`=1, `lang`=id | 100 |
| GET | `/api/v1/series/:id` | Series detail | `id`*=5510, `lang`=id | - |
| GET | `/api/v1/series/:id/episodes` | Episode list | `id`*=5510, `lang`=id | - |
| GET | `/api/v1/play/:series_id/:section_id` | Video URL | `series_id`*=5510, `section_id`*=385380, `lang`=id | - |

### flickshort

Base: `https://captain.sapimu.au/flickshort`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | Supported languages | - | - |
| GET | `/api/v1/search` | Search drama | `q`*=love, `lang`=id, `limit`=30 | 100 |
| GET | `/api/v1/recommend` | Recommended dramas | `page`=1, `limit`=30, `lang`=id, `origin`=en | - |
| GET | `/api/v1/drama/:id` | Drama detail with episodes | `id`*=3702, `lang`=id | - |
| GET | `/api/v1/drama/:id/episode/:ep` | Episode video URL with subtitles | `id`*=3702, `ep`*=1, `lang`=en | - |

### freereels

Base: `https://captain.sapimu.au/freereels`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/foryou` | For You feed | `page`=5, `lang`=id-ID | - |
| GET | `/api/v1/popular` | Drama populer | `page`=0, `lang`=id-ID | - |
| GET | `/api/v1/new` | Drama baru | `page`=0, `lang`=id-ID | - |
| GET | `/api/v1/female` | Dramas for women | `page`=0, `lang`=id-ID | - |
| GET | `/api/v1/male` | Dramas for men | `page`=0, `lang`=id-ID | - |
| GET | `/api/v1/anime` | Anime | `page`=0, `lang`=id-ID | - |
| GET | `/api/v1/dubbing` | Drama dubbing | `page`=0, `lang`=id-ID | - |
| GET | `/api/v1/search` | Search drama | `q`*=cinta, `lang`=id-ID, `limit`=50 | 100 |
| GET | `/api/v1/dramas/:id` | Drama detail | `id`*=KsuTN1GuYp, `lang`=id-ID | - |
| GET | `/api/v1/dramas/:id/episodes` | Episode list | `id`*=KsuTN1GuYp, `lang`=id-ID | - |
| GET | `/api/v1/dramas/:id/play/:ep` | Episode video URL | `id`*=KsuTN1GuYp, `ep`*=15, `lang`=id-ID | 100 |
| GET | `/api/v1/coming-soon` | Coming soon dramas | `lang`=id-ID | - |

### fundrama

Base: `https://captain.sapimu.au/fundrama`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | List supported languages | - | - |
| GET | `/api/v1/dramas` | Drama list | `lang`=en, `page`=1, `limit`=50 | - |
| GET | `/api/v1/drama/:id` | Drama detail | `id`*=2014226264979845122 | - |
| GET | `/api/v1/drama/:id/episodes` | Episode list with video URL | `id`*=2014226264979845122, `lang`=en | - |
| GET | `/api/v1/drama/:id/episode/:ep` | Single episode video URL | `id`*=2014226264979845122, `ep`*=15, `quality`=720P | - |
| GET | `/api/v1/search` | Search drama | `q`*=love, `lang`=en | 100 |

### goodshort

Base: `https://captain.sapimu.au/goodshort`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/home` | Homepage dramas (562=ID, 564=PT, 565=KR, 568=TH) | `channelId`=562, `page`=1, `pageSize`=12 | - |
| GET | `/api/v1/search` | Search drama | `q`*=love | 100 |
| GET | `/api/v1/book/:id` | Drama detail | `id`*=31001107002 | - |
| GET | `/api/v1/chapters/:bookId` | Chapter list | `bookId`*=31001107002 | - |
| GET | `/api/v1/play/:bookId/:chapterId` | Episode video URL | `bookId`*=31001107002, `chapterId`*=13912781, `q`=720p | - |
| GET | `/api/v1/unlock/:bookId` | Unlock all episodes | `bookId`*=31001107002, `q`=720p | - |
| GET | `/api/v1/segments` | Proxy segment/m3u8 | `url`*=https://acfs1.goodreels.com/ets/books/002/31001107002/536865/dnbhx4dffv/720p/w5gvs4kfgr_720p.m3u8 | - |
| GET | `/api/v1/key` | Get decryption key | - | - |

### hishort

Base: `https://captain.sapimu.au/hishort`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/home` | Homepage popular dramas | - | - |
| GET | `/api/v1/search/:q` | Search drama | `q`*=love | 100 |
| GET | `/api/v1/drama/:id` | Drama detail + episodes | `id`*=3688 | - |
| GET | `/api/v1/episode/:slug` | Episode video URL | `slug`*=3688_1 | - |

### idrama

Base: `https://captain.sapimu.au/idrama`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/search` | Search dramas by keyword (lang: id, en, ja, ko, es, pt, th) | `q`*=love, `page_size`=20, `lang`=id | 100 |
| GET | `/api/v1/popular` | Popular dramas | `page`=1, `limit`=20, `lang`=id | - |
| GET | `/api/v1/ranking/trending` | Trending dramas | `page`=1, `limit`=20, `lang`=id | - |
| GET | `/api/v1/ranking/hits` | New hits dramas | `page`=1, `limit`=20, `lang`=id | - |
| GET | `/api/v1/latest` | Latest dramas | `page`=1, `limit`=20, `lang`=id | - |
| GET | `/api/v1/genres` | Get all available genres | `lang`=id | - |
| GET | `/api/v1/genre/:id` | Dramas by genre | `id`*=section_476014f5, `page`=1, `limit`=20, `lang`=id | - |
| GET | `/api/v1/drama/:id` | Drama detail with episodes | `id`*=160000640162, `lang`=id | - |
| POST | `/api/v1/unlock/:dramaId` | Unlock episodes and get video URLs (720p) | `dramaId`*=160000640162 | 100 |

### melolo

Base: `https://captain.sapimu.au/melolo`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | List 56 supported languages | - | - |
| GET | `/api/v1/search` | Search drama | `q`*=love, `lang`=en, `limit`=50, `offset`=0 | 100 |
| GET | `/api/v1/search/suggest` | Search suggestions | `q`*=love, `lang`=en | 100 |
| GET | `/api/v1/bookmall` | Bookmall home content | `lang`=en | - |
| GET | `/api/v1/bookmall/tabs` | Bookmall tabs (0=all, 1=male, 2=female) | `gender`=0, `lang`=en | - |
| GET | `/api/v1/book` | Book/drama detail | `id`*=7602461581250661429, `lang`=en | - |
| GET | `/api/v1/series` | Series detail + all episodes | `id`*=7602461581250661429, `lang`=en | - |
| GET | `/api/v1/multi-video` | Get all video URLs from series (cached 30 min) | `id`*=7602461581250661429, `lang`=en | 100 |

### meloshort

Base: `https://captain.sapimu.au/meloshort`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/drama/all` | Drama list (lang: en, ja, id, th, zh-TW, ms, ko, es, pt, de, tr, fr, ar) | `page`=1, `limit`=20, `lang`=th | - |
| GET | `/api/v1/dramas/discover` | Discover dramas (lang: en, ja, id, th, zh-TW, ms, ko, es, pt, de, tr, fr, ar) | `page`=1, `limit`=20, `lang`=th | - |
| GET | `/api/v1/dramas/top` | Top ranked dramas (lang: en, ja, id, th, zh-TW, ms, ko, es, pt, de, tr, fr, ar) | `lang`=th | - |
| GET | `/api/v1/dramas/search` | Search drama (lang: en, ja, id, th, zh-TW, ms, ko, es, pt, de, tr, fr, ar) | `q`*=love, `lang`=th | 100 |
| GET | `/api/v1/dramas/:id/episodes` | Episode list (lang: en, ja, id, th, zh-TW, ms, ko, es, pt, de, tr, fr, ar) | `id`*=67fcc11e6227713935f4d63c, `page`=1, `limit`=100, `lang`=th | - |
| GET | `/api/v1/dramas/:id/episodes/:chapter` | Episode video URL (lang: en, ja, id, th, zh-TW, ms, ko, es, pt, de, tr, fr, ar) | `id`*=67fcc11e6227713935f4d63c, `chapter`*=67fcc1206227713935f4d63d, `lang`=th | - |

### microdrama

Base: `https://captain.sapimu.au/microdrama`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | List supported languages | - | - |
| GET | `/api/v1/dramas` | Drama list | `lang`=id, `limit`=50 | - |
| GET | `/api/v1/dramas/search` | Search drama | `q`*=love, `lang`=id | 100 |
| GET | `/api/v1/dramas/:id` | Drama detail + episodes with video URL | `id`*=2008052547485241345 | - |

### minutedrama

Base: `https://captain.sapimu.au/minutedrama`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/popular` | Popular videos | `page`=1, `size`=20 | - |
| GET | `/api/v1/videos/:id` | Video detail + episodes | `id`*=438, `source`=1001 | - |
| GET | `/api/v1/search` | Search videos | `q`*=love, `page`=1, `size`=20 | 100 |

### moboreels

Base: `https://captain.sapimu.au/moboreels`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/languages` | List 19 supported languages (langId mapping) | - | - |
| GET | `/api/channelList` | List of main channels/categories | `langId`=3 | - |
| GET | `/api/channelDetail` | Channel detail + series list per section | `schemeId`*=33850170630471777, `channelId`*=162979468352028714, `skipSeries`=0, `langId`=3 | - |
| GET | `/api/hotList` | List of hot/trending dramas (10=Trending, 11=Latest) | `listId`*=10, `skipSeries`=0, `schemeId`=33850170630471777, `langId`=3 | - |
| GET | `/api/seriesDetail` | Drama detail (title, cover, genre, episodes, status) | `seriesId`*=42517322, `langId`=3 | - |
| GET | `/api/seriesPage` | All series episodes (auto-paginate from seriesDetail) | `seriesId`*=42517322, `langId`=3 | - |
| GET | `/api/guessYouLike` | Drama rekomendasi serupa | `seriesId`*=42517322, `langId`=3 | - |
| GET | `/api/video` | Episode video URL (auto-unlock). Referer: https://www.cdreader.com/ | `seriesId`*=42517322, `episNum`*=1, `langId`=3 | 100 |
| GET | `/api/proxy/subtitle` | Proxy subtitle | `episId`*=194010993662543603, `langId`=3 | - |
| GET | `/api/search` | Search drama by keyword (pagination support) | `searchKey`*=love, `pageNo`=1, `pageSize`=20, `langId`=3 | 100 |

### netshort

Base: `https://captain.sapimu.au/netshort`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | Available languages | - | - |
| GET | `/api/v1/tabs` | List tabs with ID (for custom tab access) | `lang`=id_ID | - |
| GET | `/api/v1/tab/:tabId/:page` | Custom tab content by ID (get ID from /tabs endpoint) | `tabId`*=1894702358019043329, `page`*=1, `lang`=id_ID | - |
| GET | `/api/v1/feed/:page` | Feed rekomendasi | `page`*=1, `lang`=id_ID | - |
| GET | `/api/v1/explore/:page` | Jelajahi | `page`*=1, `lang`=id_ID | - |
| GET | `/api/v1/new/:page` | Drama baru | `page`*=1, `lang`=id_ID | - |
| GET | `/api/v1/dubbing/:page` | Drama dubbing | `page`*=1, `lang`=id_ID | - |
| GET | `/api/v1/vip/:page` | VIP dramas | `page`*=1, `lang`=id_ID | - |
| GET | `/api/v1/search/:keyword/:page` | Cari drama | `keyword`*=love, `page`*=1, `lang`=id_ID | 100 |
| GET | `/api/v1/search-hint` | Search hint/suggestions | `lang`=id_ID | 100 |
| GET | `/api/v1/categories` | Categories list | `lang`=id_ID | - |
| GET | `/api/v1/category/:page` | Category dramas. region: 0=All, 1=Local, 2=Asia, 3=Western. audio: 0=All, 1=Subtitle, 2=Dubbed. tagId: from /categories cascadeTag level 3 | `page`*=1, `region`=0, `audio`=0, `tagId`=1983832175469740041, `lang`=id_ID | - |
| GET | `/api/v1/detail/:id` | Drama detail | `id`*=1994614483446874114, `lang`=id_ID | - |
| GET | `/api/v1/similar/:id` | Similar dramas | `id`*=1994614483446874114, `lang`=id_ID | - |
| GET | `/api/v1/episode/:id/:episodeNo` | Episode detail | `id`*=1994614483446874114, `episodeNo`*=15, `lang`=id_ID | 100 |

### pinedrama

Base: `https://captain.sapimu.au/pinedrama`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/languages` | Daftar 16 bahasa yang didukung | - | - |
| GET | `/api/drama/categories` | Daftar genre/scenes | `language`=id, `region`=ID | - |
| GET | `/api/drama/center` | Katalog drama (browse by category) | `scene`=1, `category_id`=0, `count`=20, `language`=id, `region`=ID | - |
| GET | `/api/drama/search` | Search drama by title | `keyword`*=cinta, `language`=id, `region`=ID | 100 |
| GET | `/api/drama/detail` | Detail drama | `collection_id`*=7633642976383783953, `language`=id, `region`=ID | - |
| GET | `/api/drama/episodes` | Daftar episode | `collection_id`*=7633642976383783953, `language`=id, `region`=ID | - |
| GET | `/api/drama/play` | Play URL + subtitle | `collection_id`*=7633642976383783953, `episode`*=1, `language`=id, `region`=ID | - |

### radreels

Base: `https://captain.sapimu.au/radreels`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | List available languages | - | - |
| GET | `/api/v1/home` | Homepage | `lang`=en | - |
| GET | `/api/v1/tab/:id` | Tab content | `id`*=26, `page`=1, `size`=20, `lang`=en | - |
| GET | `/api/v1/search/:query` | Search drama | `query`*=love, `page`=1, `lang`=en | 100 |
| GET | `/api/v1/drama/:keyword` | Drama detail | `keyword`*=contract-love, `page`=1, `lang`=en | - |
| GET | `/api/v1/episodes/:fakeId` | All episodes | `fakeId`*=xBq, `lang`=en | - |
| GET | `/api/v1/video/:videoFakeId/:episodicDramaId` | Video URL | `videoFakeId`*=pxkO, `episodicDramaId`*=1079, `lang`=en | - |
| GET | `/api/v1/ranking` | Ranking | `lang`=en | - |
| GET | `/api/v1/foryou` | For You feed | `page`=1, `lang`=en | - |

### rapidtv

Base: `https://captain.sapimu.au/rapidtv`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/dramas` | List dramas | `page`=1, `size`=20, `lang`=in | - |
| GET | `/api/v1/dramas/:id` | Drama detail + episodes | `id`*=2008052217783586817, `lang`=in | - |
| GET | `/api/v1/dramas/:id/episodes` | All episodes with video URLs | `id`*=2008052217783586817, `lang`=in | - |
| GET | `/api/v1/search` | Search drama | `q`*=love, `page`=1, `size`=20, `lang`=in | 100 |

### reelala

Base: `https://captain.sapimu.au/reelala`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/languages` | Supported languages | - | - |
| GET | `/api/home` | Homepage feed | `lang`=id | - |
| GET | `/api/for-you` | For you recommendations | `lang`=id | - |
| GET | `/api/chapters` | Drama chapters/episodes | `playlet_id`*=489, `lang`=id | - |
| GET | `/api/search` | Search drama | `keyword`*=love, `lang`=en | 100 |
| GET | `/api/search/hot` | Hot/trending search | `lang`=id | 100 |

### reelife

Base: `https://captain.sapimu.au/reelife`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/dramas` | Drama list | `tab`=0, `page`=1, `size`=20 | - |
| GET | `/api/v1/dramas/:id` | Drama detail | `id`*=42000003903 | - |
| GET | `/api/v1/dramas/:id/chapters` | Chapter list | `id`*=42000003903 | - |
| GET | `/api/v1/dramas/:bookId/episodes/:chapterId` | Episode video URL | `bookId`*=42000003903, `chapterId`*=15 | - |
| GET | `/api/v1/foryou` | For You feed | `page`=1, `size`=30 | - |
| GET | `/api/v1/search` | Search drama | `q`*=love, `page`=1, `size`=20 | 100 |
| GET | `/api/v1/search/suggest` | Search suggestions | `q`*=love | 100 |
| GET | `/api/v1/ranking` | Drama ranking | `rankId`=18 | - |

### reelshort

Base: `https://captain.sapimu.au/reelshort`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/foryou` | For You feed | `lang`=in | - |
| GET | `/api/v1/new` | New releases | `lang`=in | - |
| GET | `/api/v1/completed` | Completed series | `lang`=in | - |
| GET | `/api/v1/romance` | Romance category | `lang`=in | - |
| GET | `/api/v1/drama` | Drama category | `lang`=in | - |
| GET | `/api/v1/feed/:tabId` | Feed by tab ID | `tabId`*=42954, `lang`=in | - |
| GET | `/api/v1/search` | Search drama | `q`*=love, `page`=1, `lang`=in | 100 |
| GET | `/api/v1/search/suggestions` | Search suggestions | `lang`=in | 100 |
| GET | `/api/v1/book/:id` | Book detail | `id`*=69d8729ecc72400a320dab60, `lang`=in | - |
| GET | `/api/v1/book/:id/chapters` | Chapter list | `id`*=69d8729ecc72400a320dab60, `lang`=in | - |
| GET | `/api/v1/book/:id/chapter/:chapterId/video` | Episode video (auto-unlock) | `id`*=69d8729ecc72400a320dab60, `chapterId`*=4m4o6mh49t | - |

### sarostv

Base: `https://captain.sapimu.au/sarostv`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/languages` | List 13 supported languages | - | - |
| GET | `/api/theater` | Homepage theater/feed | `lang`=en_US | - |
| GET | `/api/recommend` | Recommended dramas | `lang`=en_US | - |
| GET | `/api/types` | Drama categories/types | `lang`=en_US | - |
| GET | `/api/series/search` | Search series | `q`*=love | 100 |
| GET | `/api/series` | Series detail + episode list | `id`*=100, `lang`=en_US | - |
| GET | `/api/series/episode` | Episode video URL | `id`*=100, `ep`*=1, `lang`=en_US | - |

### sereal

Base: `https://captain.sapimu.au/sereal`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/languages` | Supported languages | - | - |
| GET | `/api/index/home/:page` | Homepage feed | `page`*=1, `lang`=id | - |
| GET | `/api/index/for-you/:page` | For You feed | `page`*=1, `lang`=id | - |
| GET | `/api/index/search/:q` | Search drama | `q`*=cinta, `lang`=id | 100 |
| GET | `/api/index/trending` | Trending dramas | `lang`=id | - |
| GET | `/api/index/content-search/:contentId/:page` | Content search by ID | `contentId`*=184745566088204320, `page`*=1, `lang`=id | 100 |
| GET | `/api/content/detail` | Drama detail | `contentId`*=179663844862607360, `lang`=id | - |
| GET | `/api/content/recommend-smart/:page` | Smart recommendations | `page`*=1, `lang`=id | - |
| GET | `/api/watch/:contentId/:ep` | Episode video URL | `contentId`*=179663844862607360, `ep`*=1, `lang`=id | - |

### shortbox

Base: `https://captain.sapimu.au/shortbox`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/languages` | Daftar bahasa tersedia | - | - |
| GET | `/api/categories` | Daftar kategori drama | `lang`=id | - |
| GET | `/api/list` | Browse drama (ShortBox) | `page`=1, `page_size`=10, `languages`=id, `streamable`=true | - |
| GET | `/api/new-list` | Drama terbaru (PSSDK) | `page`=1, `page_size`=10, `languages`=id | - |
| GET | `/api/recommend` | Rekomendasi home | `languages`=id, `streamable`=true | - |
| GET | `/api/for-you` | Feed For You (paginasi lokal) | `page`=1, `page_size`=10, `languages`=id, `streamable`=true | - |
| GET | `/api/hot-search` | Drama populer/trending | `languages`=id | 100 |
| GET | `/api/search` | Cari drama (alias: query, keyword) | `q`*=cinta, `page`=1, `page_size`=10, `languages`=id | 100 |
| GET | `/api/info/:id` | Detail drama + daftar episode | `id`*=7009, `sort`=1, `languages`=id | - |
| GET | `/api/stream/:id/:ep` | Stream URL (m3u8/DRM) | `id`*=6451, `ep`*=1, `quality`=720 | - |

### shorten

Base: `https://captain.sapimu.au/shorten`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/editors` | Editor picks | `page`=1, `perPage`=20 | - |
| GET | `/api/v1/exclusive` | Exclusive dramas | `page`=1, `perPage`=20 | - |
| GET | `/api/v1/dubbed` | Dubbed dramas | `page`=1, `perPage`=20 | - |
| GET | `/api/v1/releases` | New releases | `page`=1, `perPage`=20 | - |
| GET | `/api/v1/categories` | Categories list | - | - |
| GET | `/api/v1/explore` | Explore page | - | - |
| GET | `/api/v1/series/:slug` | Series detail + episodes (video hash included) | `slug`*=runaway-billionaire-becomes-my-groom-dubbing | - |

### shortmax

Base: `https://captain.sapimu.au/shortmax`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/search` | Search drama | `q`*=love, `lang`=id, `page`=1 | 100 |
| GET | `/api/v1/home` | Homepage by tab | `tab`=1, `lang`=id | - |
| GET | `/api/v1/feed/recommend` | Tab Rekomendasi | `lang`=id | - |
| GET | `/api/v1/feed/vip` | Tab VIP | `lang`=id | - |
| GET | `/api/v1/feed/new` | Tab Baru | `lang`=id | - |
| GET | `/api/v1/feed/ranked` | Tab Peringkat (3 section) | `lang`=id | - |
| GET | `/api/v1/feed/war` | Tab Dewa Perang | `lang`=id | - |
| GET | `/api/v1/feed/epic` | Tab Dunia Epic | `lang`=id | - |
| GET | `/api/v1/feed/romance` | Tab Romantis | `lang`=id | - |
| GET | `/api/v1/foryou` | For You feed | `page`=1, `lang`=id | - |
| GET | `/api/v1/detail/:code` | Drama detail | `code`*=843852, `lang`=id | - |
| GET | `/api/v1/play/:code` | Episode video URL (VIP) | `code`*=843852, `ep`*=15, `lang`=id | - |
| GET | `/api/v1/languages` | Supported languages | - | - |

### shortsky

Base: `https://captain.sapimu.au/shortsky`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/languages` | Supported languages | - | - |
| GET | `/api/home` | Homepage feed | `lang`=id_id | - |
| GET | `/api/recommend` | Recommended dramas | `lang`=id_id | - |
| GET | `/api/search` | Search drama | `q`*=love, `page`=1, `lang`=id_id | 100 |
| GET | `/api/drama/:id` | Drama detail | `id`*=692, `lang`=id_id | - |
| GET | `/api/drama/:id/episode/:ep` | Episode video URLs (480/720/1080) | `id`*=692, `ep`*=1, `lang`=id_id | - |

### shortwave

Base: `https://captain.sapimu.au/shortwave`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/set-lang/:lang` | Set language. Title, tags, content change accordingly | `lang`*=in | - |
| GET | `/api/top` | Drama trending | `lang`=in | - |
| GET | `/api/all` | All dramas | `lang`=in | - |
| GET | `/api/more` | Dramas with pagination | `page`=1, `page_size`=20, `lang`=in | - |
| GET | `/api/rankings` | Ranking drama | `lang`=in | - |
| GET | `/api/search/:query` | Cari drama | `query`*=cinta, `lang`=in | 100 |
| GET | `/api/drama/:dramaId` | Drama detail + all episodes + cover per episode | `dramaId`*=694a475a5f4a5417dbedc27c, `lang`=in | - |
| GET | `/api/stream/:dramaId/:chapterId` | Stream URL (M3U8) + subtitle (WebVTT). Auto unlock jika locked | `dramaId`*=694a475a5f4a5417dbedc27c, `chapterId`*=694a475b5f4a5417dbedc27d, `lang`=in | - |

### shotshort

Base: `https://captain.sapimu.au/shotshort`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/languages` | List of 13 supported languages | - | - |
| GET | `/api/popular` | Popular dramas | `page`=1, `limit`=20, `lang`=id | - |
| GET | `/api/search` | Search dramas | `q`*=love, `page`=1, `limit`=20, `lang`=id | 100 |
| GET | `/api/book/:id` | Drama detail with episodes | `id`*=1558, `lang`=id | - |
| GET | `/api/book/:id/episodes` | List all episodes with chapterId | `id`*=1558, `lang`=id | - |
| GET | `/api/book/:bookId/chapter/:chapterId` | Chapter video URL with auto-fetch subtitles | `bookId`*=1558, `chapterId`*=31830, `lang`=id | - |
| GET | `/api/category/list` | Category list | `lang`=id | - |
| GET | `/api/category` | Category content (case-sensitive: Romance, Urban, Mafia) | `category`=Romance, `page`=1, `limit`=20, `lang`=id | - |

### snackshort

Base: `https://captain.sapimu.au/snackshort`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/home` | Homepage feed | `lang`=Indonesian | - |
| GET | `/api/v1/tabs` | Drama tabs | `lang`=Indonesian | - |
| GET | `/api/v1/browsing` | Browse dramas | `page`=1, `pageSize`=20, `lang`=Indonesian | - |
| GET | `/api/v1/search` | Search drama by keyword (q), or get search terms if no q | `q`=love, `page`=1, `limit`=20, `lang`=Indonesian | 100 |
| GET | `/api/v1/book/:bookId` | Book/drama detail | `bookId`*=123, `lang`=Indonesian | - |
| GET | `/api/v1/book/:bookId/chapters` | Chapter list | `bookId`*=123, `lang`=Indonesian | - |
| GET | `/api/v1/book/:bookId/episode/:chapterId` | Episode video URL | `bookId`*=123, `chapterId`*=9150, `lang`=Indonesian | - |

### sodareels

Base: `https://captain.sapimu.au/sodareels`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/home` | Homepage feed | `page`=1, `count`=20, `lang`=id | - |
| GET | `/api/v1/search` | Search drama | `q`*=love, `lang`=id | 100 |
| GET | `/api/v1/drama/:id` | Episode video URLs (use ewash from /info) | `id`*=2008415452123893762 | - |
| GET | `/api/v1/info/:id` | Drama info + episode list | `id`*=2008052547485241345 | - |
| GET | `/api/v1/category` | Category list | `cat`, `page`=1, `count`=20 | - |
| GET | `/api/v1/episodes` | Episode video URLs (use ewash from /info) | `ids`*=2008415452123893762 | - |

### stardusttv

Base: `https://captain.sapimu.au/stardusttv`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | List supported languages | - | - |
| GET | `/api/v1/homepage` | Homepage feed | `lang`=th | - |
| GET | `/api/v1/categories` | Category list | `lang`=th | - |
| GET | `/api/v1/category/:id` | Videos by category with pagination | `id`*=1, `lang`=th, `page`=2, `page_size`=10 | - |
| GET | `/api/v1/search` | Search drama with pagination | `q`*=love, `lang`=th, `page`=2, `page_size`=10 | 100 |
| GET | `/api/v1/video/:id` | Video detail + all episodes | `id`*=15172, `lang`=th | - |
| GET | `/api/v1/video/:id/episode/:episode` | Episode stream URL (H264/H265) | `id`*=15172, `episode`*=1, `lang`=th | - |

### starshort

Base: `https://captain.sapimu.au/starshort`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | List supported languages (returns id:name mapping) | - | - |
| GET | `/api/v1/dramas` | Popular dramas (lang: 3=English, 4=Indonesian) | `lang`=4 | - |
| GET | `/api/v1/dramas/new` | New releases | `lang`=4 | - |
| GET | `/api/v1/dramas/search` | Search drama | `q`*=love, `lang`=4 | 100 |
| GET | `/api/v1/dramas/:dramaId` | Drama detail | `dramaId`*=Gaen, `lang`=4 | - |
| GET | `/api/v1/dramas/:dramaId/episodes` | Episode list | `dramaId`*=Gaen, `lang`=4 | - |
| GET | `/api/v1/dramas/:dramaId/episodes/:epNum` | Episode video URL | `dramaId`*=Gaen, `epNum`*=15, `lang`=4 | - |

### velolo

Base: `https://captain.sapimu.au/velolo`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/languages` | List available languages | - | - |
| GET | `/hot` | Drama trending/hot chart | `page`=1, `limit`=10, `lang`=id | - |
| GET | `/new` | New releases | `page`=1, `limit`=10, `lang`=id | - |
| GET | `/labels` | List categories (for labelId in /dramas) | `lang`=id | - |
| GET | `/dramas` | Browse/search drama | `q`=love, `labelId`, `page`=1, `limit`=10, `lang`=id | - |
| GET | `/detail/:id` | Drama detail + all episode URLs | `id`*=1959825426474463232, `lang`=id | - |
| GET | `/stream` | Extract .ts segments from m3u8 | `url`*=https://velolo-bunny.b-cdn.net/hls/xxx/01.m3u8 | - |

### vigloo

Base: `https://captain.sapimu.au/vigloo`

| Method | Path | Description | Params | Rate limit |
|---|---|---|---|---:|
| GET | `/api/v1/languages` | Available languages | - | - |
| GET | `/api/v1/tabs` | Home tabs | `lang`=en | - |
| GET | `/api/v1/tabs/:id` | Tab content | `id`*=15000101, `offset`, `limit`=20, `lang`=en | - |
| GET | `/api/v1/bundles/:id` | Public bundle | `id`*=15001213, `lang`=en | - |
| GET | `/api/v1/browse` | Browse programs | `sort`=POPULAR, `genre`, `country`, `limit`=30, `lang`=en | - |
| GET | `/api/v1/search` | Search dramas | `q`*=love, `limit`=20, `lang`=en | 100 |
| GET | `/api/v1/rank` | Ranking | `lang`=en | - |
| GET | `/api/v1/genres` | Genre list | `lang`=en | - |
| GET | `/api/v1/drama/:id` | Drama detail | `id`*=15000287, `lang`=en | - |
| GET | `/api/v1/drama/:programId/season/:seasonId/episodes` | Episode list | `programId`*=15000468, `seasonId`*=15000463, `lang`=en | - |
| GET | `/api/v1/play` | Get video URL + cookies | `seasonId`*=15000046, `ep`=1 | 100 |
| GET | `/api/v1/stream` | HLS stream with embedded cookies | `seasonId`*=15000046, `ep`=1 | 100 |

## Implementation notes for Dramaplay

- Do not create one giant adapter. Endpoint shapes differ; add one provider adapter at a time.
- Start with providers that have both list/search and detail/play/episode endpoints.
- Good first candidates after `shortmax`: `dramawave`, `goodshort`, `flickshort`, `fundrama`, `reelshort`, `snackshort`, `starshort`, `vigloo`.
- Add provider row to `packages/db/src/seed.ts` only after adapter can resolve episodes and stream URL.
- Existing registry file: `apps/api/src/providers/registry.ts`.
- Existing custom Sapimu adapter: `apps/api/src/providers/sapimu.ts`.
