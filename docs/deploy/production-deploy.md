# Dramaplay — Panduan Deploy Production

**Dokumen ini mencakup deploy production step-by-step untuk seluruh stack Dramaplay:**
- Cloudflare Workers (API)
- Cloudflare Pages (Admin + Consumer PWA)
- Supabase (Database + Auth + Storage)
- Pakasir (Payment Gateway)
- GitHub Actions (CI/CD)
- Deploy Android via Capacitor

---

## Arsitektur Infrastruktur

```
┌──────────────────────────────────────────────────────┐
│                    Cloudflare                         │
│                                                       │
│  ┌─────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │  Workers    │  │  Pages     │  │  Pages        │  │
│  │  api.drama- │  │  admin.    │  │  dramaplay.my.id │  │
│  │  play.id    │  │  dramaplay │  │  (consumer)   │  │
│  │  (Hono)     │  │  .id       │  │               │  │
│  └──────┬──────┘  └────────────┘  └───────────────┘  │
│         │                                              │
└─────────┼──────────────────────────────────────────────┘
          │
          ▼
┌─────────────────┐     ┌──────────────┐
│    Supabase     │     │   Pakasir    │
│  • PostgreSQL   │     │  (Payment)   │
│  • Auth         │     │              │
│  • Storage      │     │              │
└─────────────────┘     └──────────────┘
```

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Setup Supabase](#2-setup-supabase)
3. [Setup Pakasir](#3-setup-pakasir)
4. [Setup Cloudflare](#4-setup-cloudflare)
5. [Setup Domain DNS](#5-setup-domain-dns)
6. [Deploy API (Cloudflare Workers)](#6-deploy-api-cloudflare-workers)
7. [Deploy Admin (Cloudflare Pages)](#7-deploy-admin-cloudflare-pages)
8. [Deploy Consumer PWA (Cloudflare Pages)](#8-deploy-consumer-pwa-cloudflare-pages)
9. [Setup CI/CD (GitHub Actions)](#9-setup-cicd-github-actions)
10. [Database Migration](#10-database-migration)
11. [Setup Supabase Auth](#11-setup-supabase-auth)
12. [Deploy Android (Capacitor)](#12-deploy-android-capacitor)
13. [Smoke Test & Verifikasi](#13-smoke-test--verifikasi)
14. [Environment Variables Lengkap](#14-environment-variables-lengkap)
15. [Maintenance & Troubleshooting](#15-maintenance--troubleshooting)

---

## 1. Prasyarat

### Akun yang Dibutuhkan

| Layanan | Daftar di | Keterangan |
|---------|----------|------------|
| Cloudflare | https://dash.cloudflare.com/sign-up | Free tier cukup untuk MVP |
| Supabase | https://supabase.com/dashboard | Free tier atau Pro |
| Pakasir | https://pakasir.com | Payment gateway Indonesia |
| GitHub | https://github.com | Untuk repo & Actions |
| Google Play Console | https://play.google.com/console | Untuk publish Android (opsional, $25 one-time) |
| Google Cloud Console | https://console.cloud.google.com | Untuk OAuth Google (login) |

### Tools Lokal

```bash
# Node.js 20+
node --version

# pnpm 9.12.0
corepack enable
corepack prepare pnpm@9.12.0 --activate

# Wrangler CLI (Cloudflare Workers)
npm install -g wrangler

# Login Cloudflare
wrangler login
```

### Repository

```bash
git clone https://github.com/edodoyokz/dramaplay.git
cd dramaplay
pnpm install
```

---

## 2. Setup Supabase

### 2.1 Buat Project Supabase

1. Buka https://supabase.com/dashboard
2. Klik **New Project**
3. Isi:
   - **Name:** `dramaplay`
   - **Database Password:** (generate strong password, simpan)
   - **Region:** `Southeast Asia (Singapore)` — untuk latency rendah ke Indonesia
   - **Pricing Plan:** Free (atau Pro untuk production)
4. Tunggu project siap (1-2 menit)

### 2.2 Catat Credentials

Dari dashboard Supabase: **Settings → API**

```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...anon...key
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...service_role...key
```

### 2.3 Dapatkan Database URL

Dari dashboard Supabase: **Settings → Database → Connection Info**

Pilih **Connection Pooling → Transaction Mode**:

```
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

> **PENTING:** Gunakan port **6543** (PgBouncer/connection pooling) untuk Workers. Port 5432 untuk koneksi langsung.

### 2.4 Setup Row Level Security (RLS)

Buka **SQL Editor** di Supabase, jalankan file dari repo:

```bash
# Copy isi file ini ke SQL Editor Supabase
cat packages/db/supabase/profiles-trigger.sql
```

Atau buka langsung file `packages/db/supabase/profiles-trigger.sql` dan copy-paste ke **SQL Editor → New Query → Run**.

---

## 3. Setup Pakasir

### 3.1 Daftar & Dapatkan API Key

1. Daftar di https://pakasir.com
2. Buka dashboard → **Integration**
3. Catat:
   - `PAKASIR_API_KEY` — API key untuk cek detail transaksi
   - `PAKASIR_PROJECT_SLUG` — slug proyek Pakasir

### 3.2 Setup Webhook URL

Di dashboard Pakasir, set webhook URL:

```
https://api.dramaplay.my.id/pakasir/webhook
```

> **CATATAN:** Webhook akan aktif setelah API deploy dan domain live.

---

## 4. Setup Cloudflare

### 4.1 Dapatkan Credentials

1. Buka https://dash.cloudflare.com
2. **Profile → API Tokens**
3. Buat token baru:
   - **Create Custom Token**
   - Permission:
     - `Account → Workers Scripts → Edit`
     - `Account → Cloudflare Pages → Edit`
     - `Zone → DNS → Edit`
   - Account Resources: Include specific account
   - **Create Token** → salin token

```
CLOUDFLARE_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxx
```

4. Dapatkan Account ID:
   - Dashboard Cloudflare → klik domain → Overview → **Account ID** di sidebar kanan
   - Atau dari URL: `https://dash.cloudflare.com/<ACCOUNT_ID>`

```
CLOUDFLARE_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4.2 Buat Worker KV Namespace (Opsional)

Jika API menggunakan KV untuk caching:

```bash
wrangler kv:namespace create "DRAMAPLAY_CACHE"
wrangler kv:namespace create "DRAMAPLAY_CACHE" --preview
```

Catat KV ID yang dihasilkan, tambahkan ke `wrangler.toml` jika diperlukan.

---

## 5. Setup Domain DNS

### 5.1 Tambahkan Domain ke Cloudflare

1. Dashboard Cloudflare → **Add a Site**
2. Masukkan `dramaplay.my.id`
3. Pilih plan **Free**
4. Update nameserver di registrar domain ke nameserver Cloudflare

### 5.2 Setup DNS Records

Dashboard Cloudflare → **DNS → Records**:

| Type | Name | Content | Proxy | Keterangan |
|------|------|---------|-------|------------|
| CNAME | `api` | `dramaplay-api.<workers-subdomain>.workers.dev` | ✅ | API Worker |
| CNAME | `admin` | `dramaplay-admin.pages.dev` | ✅ | Admin SPA |
| CNAME | `@` | `dramaplay-consumer.pages.dev` | ✅ | Consumer PWA |
| CNAME | `www` | `dramaplay-consumer.pages.dev` | ✅ | WWW redirect |

> **CATATAN:** Workers subdomain dan Pages domain akan tersedia setelah deploy pertama. Kamu bisa setup DNS record setelah deploy selesai.

### 5.3 Setup Custom Domain di Cloudflare Pages

Setelah project Pages dibuat:

```bash
# Consumer
wrangler pages project create dramaplay-consumer --production-branch main
wrangler pages project domain add dramaplay-consumer dramaplay.my.id

# Admin
wrangler pages project create dramaplay-admin --production-branch main
wrangler pages project domain add dramaplay-admin admin.dramaplay.my.id
```

### 5.4 Setup Custom Domain di Workers

Untuk Workers API, tambahkan route di `wrangler.toml`:

```toml
[[routes]]
pattern = "api.dramaplay.my.id/*"
zone_name = "dramaplay.my.id"
```

Lalu deploy ulang dengan `wrangler deploy`.

---

## 6. Deploy API (Cloudflare Workers)

### 6.1 Setup Environment Variables

Buat file `.dev.vars` untuk local dev (JANGAN commit):

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Atau upload langsung ke Cloudflare untuk production:

```bash
cd apps/api

# Set environment variables ke Workers (production)
wrangler secret put DATABASE_URL
# > paste: postgresql://postgres.xxxxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres

wrangler secret put SUPABASE_URL
# > paste: https://xxxxxxxxxxxx.supabase.co

wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# > paste: eyJhbG...

wrangler secret put PAKASIR_API_KEY
# > paste: pk_xxxxx

wrangler secret put PAKASIR_PROJECT_SLUG
# > paste: slug proyek Pakasir, contoh: dramaplay

wrangler secret put PROVIDER_BASE_URL
# > paste: 
```

### 6.2 Update wrangler.toml

Pastikan `apps/api/wrangler.toml` sudah benar untuk production:

```toml
name = "dramaplay-api"
compatibility_date = "2024-10-01"
main = "src/index.ts"

[vars]
ENVIRONMENT = "production"
PROVIDER_BASE_URL = ""

[[routes]]
pattern = "api.dramaplay.my.id/*"
zone_name = "dramaplay.my.id"

[triggers]
crons = ["*/30 * * * *", "0 */2 * * *"]
```

### 6.3 Deploy

```bash
cd apps/api
wrangler deploy
```

Verifikasi:

```bash
curl https://api.dramaplay.my.id/health
# Response: { "status": "ok" }
```

---

## 7. Deploy Admin (Cloudflare Pages)

### 7.1 Setup Environment Variables (Cloudflare Pages)

Melalui Dashboard atau CLI:

```bash
# Set secret untuk build
wrangler pages project create dramaplay-admin --production-branch main

# Tambahkan environment variable
wrangler pages secret put VITE_API_URL --project-name dramaplay-admin
# > https://api.dramaplay.my.id
```

Atau melalui **Dashboard Cloudflare Pages → dramaplay-admin → Settings → Environment variables**:

| Key | Value | Environment |
|-----|-------|-------------|
| `VITE_API_URL` | `https://api.dramaplay.my.id` | Production |

### 7.2 Build & Deploy Manual

```bash
cd apps/admin
VITE_API_URL=https://api.dramaplay.my.id pnpm build

# Deploy ke Cloudflare Pages
wrangler pages deploy dist --project-name dramaplay-admin --branch main
```

Verifikasi:

```bash
# Buka browser
open https://admin.dramaplay.my.id
```

---

## 8. Deploy Consumer PWA (Cloudflare Pages)

### 8.1 Cache Poster Provider di R2

PineDrama dan provider lain dapat mengirim signed image URL yang kedaluwarsa. Consumer Pages Function menyimpan byte poster melalui binding R2 `IMAGE_CACHE`, memakai key stabil tanpa query signature.

```bash
# Jalankan sekali dari root repo.
pnpm --dir apps/api exec wrangler r2 bucket create dramaplay-image-cache
```

Konfigurasi binding ada di `apps/consumer/wrangler.jsonc`. Deploy consumer dari direktori `apps/consumer` agar Wrangler membaca konfigurasi tersebut. Setelah deploy pertama, jalankan sync PineDrama untuk mengisi URL yang masih fresh dan warm poster melalui aplikasi.

### 8.2 Setup Environment Variables

```bash
wrangler pages project create dramaplay-consumer --production-branch main

wrangler pages secret put VITE_API_URL --project-name dramaplay-consumer
# > https://api.dramaplay.my.id

wrangler pages secret put VITE_SUPABASE_URL --project-name dramaplay-consumer
# > https://xxxxxxxxxxxx.supabase.co

wrangler pages secret put VITE_SUPABASE_ANON_KEY --project-name dramaplay-consumer
# > eyJhbG...anon...key
```

### 8.2 Build & Deploy Manual

```bash
cd apps/consumer
VITE_API_URL=https://api.dramaplay.my.id \
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co \
VITE_SUPABASE_ANON_KEY=eyJhbG...anon...key \
pnpm build

wrangler pages deploy dist --project-name dramaplay-consumer --branch main
```

Verifikasi:

```bash
open https://dramaplay.my.id
```

---

## 9. Setup CI/CD (GitHub Actions)

### 9.1 Tambahkan Secrets ke GitHub

Buka repository GitHub: **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value | Keterangan |
|-------------|-------|------------|
| `CLOUDFLARE_API_TOKEN` | `xxx...` | Token API Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | `xxx...` | Account ID Cloudflare |
| `DATABASE_URL` | `postgresql://...` | URL database Supabase |
| `VITE_API_URL` | `https://api.dramaplay.my.id` | URL API untuk build frontend |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | URL Supabase untuk consumer |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` | Anon key Supabase |
| `API_URL` | `https://api.dramaplay.my.id` | URL API untuk smoke test |

### 9.2 Trigger Deploy Otomatis

Workflow sudah disiapkan di `.github/workflows/`:

| File | Trigger | Fungsi |
|------|---------|--------|
| `ci.yml` | PR + Push main | Typecheck + Build |
| `deploy-api.yml` | Push main (path: `apps/api/**`) | Deploy Workers |
| `deploy-admin.yml` | Push main (path: `apps/admin/**`) | Deploy Admin Pages |
| `deploy-consumer.yml` | Push main (path: `apps/consumer/**`) | Deploy Consumer Pages |
| `db-migrate.yml` | Manual (`workflow_dispatch`) | Jalankan migrasi DB |
| `smoke-test.yml` | Manual + Schedule (`0 */6 * * *`) | Smoke test tiap 6 jam |

### 9.3 Deploy via Git Push

Cukup push ke `main`, CI/CD otomatis jalan:

```bash
git add .
git commit -m "feat: something"
git push origin main
```

Untuk deploy manual API secara spesifik:

```bash
git push origin main --force  # jika hanya API yang berubah, akan trigger deploy-api.yml
```

---

## 10. Database Migration

### 10.1 Migrasi Pertama Kali

```bash
cd packages/db

# Generate migration dari schema
pnpm db:generate

# Jalankan migration ke production
DATABASE_URL=postgresql://postgres.xxxxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres \
pnpm db:migrate
```

### 10.2 Via GitHub Actions (Rekomendasi)

1. Buka GitHub repo → **Actions**
2. Pilih **DB Migrate** workflow
3. Klik **Run workflow** → **Run workflow**
4. Pantau hasil di log

### 10.3 Seed Data (Opsional)

```bash
cd packages/db
DATABASE_URL=postgresql://... pnpm db:seed
```

---

## 11. Setup Supabase Auth

### 11.1 Konfigurasi Auth Providers

Buka **Supabase Dashboard → Authentication → Providers**:

#### Email Provider
- **Enable:** ✅
- Confirm email: Optional (untuk production direkomendasikan enable)

#### Google OAuth
1. Buka https://console.cloud.google.com → **APIs & Services → Credentials**
2. **Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `https://xxxxxxxxxxxx.supabase.co/auth/v1/callback`
3. Copy **Client ID** dan **Client Secret**
4. Paste ke Supabase Dashboard → Auth → Providers → Google

### 11.2 URL Configuration

**Supabase Dashboard → Authentication → URL Configuration:**

| Setting | Development | Production |
|---------|-------------|------------|
| Site URL | `http://localhost:5173` | `https://dramaplay.my.id` |
| Redirect URLs | `http://localhost:5173/auth/callback` | `https://dramaplay.my.id/auth/callback` |

> **Redirect URLs bisa multiple,** tambahkan juga untuk admin:
> - `https://admin.dramaplay.my.id/auth/callback`

### 11.3 Database Trigger

Buka **SQL Editor** di Supabase, jalankan:

```sql
-- Copy dari packages/db/supabase/profiles-trigger.sql
-- Ini akan auto-create row di tabel 'profiles' setiap user baru signup
```

Atau buka file-nya langsung dan copy-paste:

```bash
cat packages/db/supabase/profiles-trigger.sql
```

---

## 12. Deploy Android (Capacitor)

### 12.1 Build Web App

```bash
cd apps/consumer

# Build production dengan env production
VITE_API_URL=https://api.dramaplay.my.id \
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co \
VITE_SUPABASE_ANON_KEY=eyJhbG...anon...key \
pnpm build
```

### 12.2 Sync ke Android

```bash
cd apps/consumer

# Generate/sync Android project
npx cap add android        # hanya pertama kali
npx cap sync android       # setelah build

# Update konfigurasi server
npx cap update android
```

### 12.3 Buka di Android Studio

```bash
npx cap open android
```

### 12.4 Build APK/AAB

Di Android Studio:

1. **Build → Generate Signed Bundle / APK**
2. Pilih **Android App Bundle (.aab)** untuk Play Store
3. Create new keystore (simpan password baik-baik!)
4. Build

### 12.5 Upload ke Play Store

1. Buka https://play.google.com/console
2. Buat app baru: `id.dramaplay.app`
3. Upload `.aab` ke **Production → Create new release**
4. Isi store listing, screenshots, privacy policy
5. Submit review

### 12.6 Keystore untuk CI/CD

Simpan keystore sebagai GitHub Secret untuk build otomatis:

```bash
# Encode keystore ke base64
base64 -i dramaplay.keystore -o dramaplay.keystore.b64
```

Simpan sebagai GitHub secrets:

- `ANDROID_KEYSTORE_B64` — isi file base64
- `ANDROID_KEYSTORE_PASSWORD` — password keystore
- `ANDROID_KEY_ALIAS` — alias key
- `ANDROID_KEY_PASSWORD` — password key

---

## 13. Smoke Test & Verifikasi

### 13.1 Smoke Test Script

Jalankan smoke test yang sudah tersedia:

```bash
API_URL=https://api.dramaplay.my.id bash scripts/smoke.sh
```

Atau via GitHub Actions: **Actions → Smoke Test → Run workflow**

### 13.2 Verifikasi Manual

| Komponen | URL | Cek |
|----------|-----|-----|
| API Health | `https://api.dramaplay.my.id/health` | Response 200 `{"status":"ok"}` |
| Consumer PWA | `https://dramaplay.my.id` | Halaman load, bisa login |
| Admin Panel | `https://admin.dramaplay.my.id` | Halaman load, bisa login admin |
| Supabase Auth | Login via app | Redirect berhasil, token tersimpan |
| Database | Cek data muncul di admin | Drama/providers/users tampil |
| Payment | Test transaksi Pakasir | Webhook diterima, status update |

### 13.3 Cek Cron Jobs

```bash
# Cek scheduled triggers di dashboard Workers
# Dashboard Cloudflare → Workers → dramaplay-api → Triggers
```

Harus muncul:
- `*/30 * * * *` — Health check setiap 30 menit
- `0 */2 * * *` — Catalog sync setiap 2 jam

---

## 14. Environment Variables Lengkap

### 14.1 Cloudflare Workers (`apps/api`)

| Variable | Contoh | Keterangan |
|----------|--------|------------|
| `DATABASE_URL` | `postgresql://postgres.xxx:pass@aws-0-...pooler.supabase.com:6543/postgres` | Connection string Supabase |
| `SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` | Service role key (admin) |
| `PAKASIR_API_KEY` | `pk_xxxxx` | API key Pakasir |
| `PAKASIR_PROJECT_SLUG` | `dramaplay` | Slug proyek Pakasir |
| `PROVIDER_BASE_URL` | `` | Provider API base URL |
| `ENVIRONMENT` | `production` | Environment mode |

### 14.2 Cloudflare Pages — Admin (`apps/admin`)

| Variable | Contoh | Keterangan |
|----------|--------|------------|
| `VITE_API_URL` | `https://api.dramaplay.my.id` | URL API backend |

### 14.3 Cloudflare Pages — Consumer (`apps/consumer`)

| Variable | Contoh | Keterangan |
|----------|--------|------------|
| `VITE_API_URL` | `https://api.dramaplay.my.id` | URL API backend |
| `VITE_SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` | URL project Supabase |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` | Anon/public key Supabase |

### 14.4 GitHub Actions Secrets

| Secret | Keterangan |
|--------|------------|
| `CLOUDFLARE_API_TOKEN` | Token Cloudflare API |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID Cloudflare |
| `DATABASE_URL` | Untuk migrasi DB |
| `VITE_API_URL` | Untuk build frontend |
| `VITE_SUPABASE_URL` | Untuk build consumer |
| `VITE_SUPABASE_ANON_KEY` | Untuk build consumer |
| `API_URL` | Untuk smoke test |

---

## 15. Maintenance & Troubleshooting

### 15.1 Monitoring

| Apa | Dimana | Frekuensi |
|-----|--------|-----------|
| Worker logs | `wrangler tail` atau Dashboard Cloudflare | Real-time |
| Worker metrics | Dashboard Workers → Analytics | Harian |
| Pages analytics | Dashboard Pages → Analytics | Harian |
| DB health | Dashboard Supabase → Reports | Mingguan |
| Error tracking | `wrangler tail` + log aggregation | Real-time |

### 15.2 Logging API

```bash
# Tail real-time logs Workers
wrangler tail dramaplay-api

# Filter by status
wrangler tail dramaplay-api --status error
```

### 15.3 Rollback

#### API (Workers)

```bash
# Lihat versi sebelumnya
wrangler versions list --name dramaplay-api

# Rollback ke versi tertentu
wrangler rollback <version-id> --name dramaplay-api
```

#### Pages

Dashboard Cloudflare Pages → project → **Deployments** → klik `...` pada deployment stable → **Rollback to this deployment**

### 15.4 Troubleshooting Umum

| Masalah | Solusi |
|---------|--------|
| Worker error 500 | `wrangler tail` cek log, pastikan secrets ter-setup |
| Pages build gagal | Cek env vars di Pages settings, pastikan semua `VITE_*` ada |
| Database connection timeout | Pastikan port **6543** (pooling), bukan 5432 |
| Supabase Auth redirect gagal | Cek URL configuration & redirect URLs |
| CORS error | Pastikan API mengizinkan origin `dramaplay.my.id` dan `admin.dramaplay.my.id` |
| Cron tidak jalan | Cek `[triggers]` di wrangler.toml, re-deploy |
| Domain tidak resolve | Cek DNS Cloudflare (proxy orange), tunggu propagasi 5-30 menit |

### 15.5 Backup Database

Supabase meng-handle backup otomatis untuk plan Pro ke atas. Untuk manual backup:

```bash
# Export schema + data
pg_dump "postgresql://postgres.xxx:pass@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" \
  --no-owner --no-acl -Fc > dramaplay_backup_$(date +%Y%m%d).dump
```

### 15.6 Budget (Estimasi Free Tier)

| Layanan | Free Tier Limit | Cukup untuk MVP? |
|---------|-----------------|------------------|
| Cloudflare Workers | 100k req/hari | ✅ |
| Cloudflare Pages | 1 build/500, 100K req/hari | ✅ |
| Cloudflare DNS | Unlimited | ✅ |
| Supabase Free | 500MB DB, 2 proyek | ✅ (awal) |
| Supabase Auth | 50k MAU | ✅ |
| GitHub Actions | 2000 menit/bulan | ✅ |
| Play Store | One-time $25 | ✅ |

---

## Checklist Deploy Production

- [ ] Supabase project dibuat & kredensial dicatat
- [ ] Database migration dijalankan (schema + trigger profiles)
- [ ] Supabase Auth dikonfigurasi (Email + Google OAuth)
- [ ] Pakasir API key & webhook secret didapat
- [ ] Cloudflare API token dibuat
- [ ] Domain `dramaplay.my.id` diarahkan ke Cloudflare nameserver
- [ ] DNS records di-setup (api, admin, @, www)
- [ ] Secrets Cloudflare Workers di-upload (`wrangler secret put`)
- [ ] API di-deploy & health check OK
- [ ] Admin Pages di-deploy & bisa diakses
- [ ] Consumer Pages di-deploy & bisa diakses
- [ ] Supabase redirect URLs di-update ke production URL
- [ ] GitHub secrets diisi semua
- [ ] GitHub Actions CI/CD berjalan sukses
- [ ] Smoke test passed
- [ ] Android APK/AAB dibuild & di-upload (opsional)
- [ ] Cron triggers berjalan
- [ ] Pakasir webhook URL dicatat di dashboard Pakasir
- [ ] SSL/TLS aktif (otomatis oleh Cloudflare — cek padlock hijau)
- [ ] Database backup disetup (jika perlu)

---

## Referensi

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Supabase Docs](https://supabase.com/docs)
- [Pakasir Docs](https://pakasir.com/p/docs)
- [Capacitor Android Docs](https://capacitorjs.com/docs/android)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)

---

**Dokumen ini akan di-update seiring project berkembang.**
**Terakhir diupdate:** 2026-06-22
