# Tutorial Lengkap — Auto Fill

Panduan pemakaian dari nol sampe jalan. Ikuti dari atas ke bawah, pilih salah satu metode di Step 3.

> **Tool ini untuk testing form yang lu miliki sendiri atau Stripe test-mode session.** Bukan untuk form orang lain.

---

## ⚡ Opsi super-cepat (one-shot)

Kalau lu mau langsung jalan tanpa baca semua step ini:

```sh
git clone https://github.com/nopperabbo/auto-fill.git
cd auto-fill
./setup.sh                                        # auto-install semua deps + generate profiles
./autofill https://your-site.test/checkout --submit
```

`setup.sh` install Python venv + pip deps + Playwright Chromium + Node deps + generate `profiles.json` (10 US profile). `autofill` wrapper auto-pick Node kalau ada, fallback ke Python.

Kalau mau customize (metode lain, manual profile, dll), lanjut ke Step 1.

---

## Step 1 — Clone repo

```sh
git clone https://github.com/nopperabbo/auto-fill.git
cd auto-fill
```

---

## Step 2 — Siapkan data profile

Lu butuh satu file `profiles.json` di root folder. Ada 2 cara:

### Cara A — Generate otomatis (recommended, 10 US profiles)

Bikin 10 entry US pake Faker + 10 kartu test Stripe (Visa, Mastercard, Amex, Discover, JCB, Diners Club, debit variants). Nama, alamat, state, ZIP, semua realistic dan match.

```sh
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python gen-profiles.py --out ../profiles.json
```

Hasil: `profiles.json` dengan key `us_01` sampai `us_10`. Default profile-nya `us_01`.

**Opsi tambahan:**

| Flag | Fungsi |
|---|---|
| `--count 5` | Generate 5 profile aja (min 1, max 10) |
| `--seed 42` | Reproducible output — lu bisa generate ulang hasil yang sama |
| `--force` | Timpa `profiles.json` kalau sudah ada |
| `--out <path>` | Tulis ke file lain |

**Contoh preview satu entry:**

```json
{
  "label": "Visa — Danielle Johnson",
  "card": {
    "number": "4242 4242 4242 4242",
    "expMonth": "04",
    "expYear": "30",
    "cvc": "242",
    "holder": "Danielle Johnson"
  },
  "billing": {
    "email": "danielle.johnson@example.com",
    "phone": "+1 555 0194",
    "country": "US",
    "countryName": "United States",
    "line1": "819 Johnson Course",
    "line2": "",
    "city": "East William",
    "state": "Kentucky",
    "stateCode": "KY",
    "postalCode": "40111"
  }
}
```

### Cara B — Tulis manual

```sh
cp profiles.example.json profiles.json
```

Edit `profiles.json`. Minimum banget isinya:

```json
{
  "defaultProfile": "gue",
  "profiles": {
    "gue": {
      "card": {
        "number": "4242 4242 4242 4242",
        "expMonth": "12",
        "expYear": "34",
        "cvc": "123",
        "holder": "Nama Lu"
      },
      "billing": {
        "country": "US",
        "line1": "123 Main St",
        "city": "New York",
        "state": "New York",
        "stateCode": "NY",
        "postalCode": "10001"
      }
    }
  }
}
```

Semua field optional. Engine cuma isi apa yang ada di form target.

**Tips penting:**
- `profiles.json` ada di `.gitignore`. Ga akan kepush ke git.
- Untuk form yang country-nya beda negara (Indonesia misalnya), ubah `country: "ID"`, `countryName: "Indonesia"`, `state: "DKI Jakarta"`, `stateCode: "JK"`, dst.
- `expYear` boleh 2 digit (`34`) atau 4 digit (`2034`). Engine ngatur sendiri.

---

## Step 3 — Pilih metode pemakaian

Lima cara pake. Pilih yang sesuai kebiasaan lu. Urutan dari paling gampang ke paling powerful:

| Metode | Kapan dipake | Section |
|---|---|---|
| **Chrome extension** | Daily use, click-to-fill di checkout real | [3A](#3a--chrome-extension-paling-sering-dipake) |
| **Tampermonkey** | Firefox user, atau mau auto-inject tanpa install extension | [3B](#3b--tampermonkey-userscript) |
| **Bookmarklet** | Paling simple, tinggal drag ke bookmark bar | [3C](#3c--bookmarklet) |
| **Playwright Node CLI** | Automated testing, headless, reproducible | [3D](#3d--playwright-cli-node) |
| **Playwright Python CLI** | Sama tapi stack Python | [3E](#3e--playwright-cli-python) |

---

### 3A — Chrome extension (paling sering dipake)

#### Install

1. Buka `chrome://extensions/` di Chrome/Edge
2. Toggle **Developer mode** (pojok kanan atas)
3. Klik **Load unpacked**
4. Pilih folder `extension/` dari repo ini
5. Pin icon-nya: klik puzzle icon → push-pin di sebelah **Auto Fill**

#### Import profiles ke extension

Extension nyimpen data di `chrome.storage.local`, terpisah dari `profiles.json`. Import sekali:

1. Klik icon **Auto Fill** → popup muncul
2. Klik **Edit profiles JSON**
3. Paste isi `profiles.json` lu (yang Step 2 tadi)
4. Klik **Save**

Dropdown di popup langsung keisi semua profile lu. Refresh page checkout yang lagi kebuka.

#### Empat cara trigger fill

| Cara | Aksi | Keterangan |
|---|---|---|
| **Floating button** | Muncul otomatis di pojok kanan bawah kalau page punya card field | 1 klik "Fill" = cuma isi, "+ Submit" = isi + klik submit, X = sembunyiin |
| **Keyboard shortcut fill** | `Ctrl+Shift+F` (macOS: ⌘+Shift+F) | Pake default profile, cuma isi |
| **Keyboard shortcut fill+submit** | `Ctrl+Shift+X` | Pake default profile, isi + submit |
| **Right-click menu** | Klik kanan di page → **Auto Fill → Fill — `<profile>`** | Pilih profile apa aja |

#### Ganti default profile

Di popup, pilih profile di dropdown, trus klik **Fill** sekali (itu set default baru). Atau edit JSON, ganti `defaultProfile` ke key yang lu mau.

---

### 3B — Tampermonkey userscript

Cocok untuk Firefox user, atau yang prefer Tampermonkey daripada extension install.

#### Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) di browser lu
2. Buka file `userscript/autofill.user.js` di repo ini → Tampermonkey nanya confirm install → terima
3. Import profiles: klik icon Tampermonkey → **Edit profiles (JSON)** → paste isi `profiles.json` → save

#### Trigger

Klik icon Tampermonkey di page apapun, muncul menu:
- **Fill — `<profile>`** (satu entry per profile lu)
- **Fill + Submit — `<profile>`**
- **Edit profiles (JSON)**

Bisa inject ke iframe Stripe karena script-nya `@match https://js.stripe.com/*`.

---

### 3C — Bookmarklet

Paling simple, ga perlu install apa-apa di extension manager. Tapi ada limitation: **ga bisa tembus iframe Stripe** karena cross-origin sandbox. Cocok untuk form polos atau React same-origin.

#### Build

```sh
cd bookmarklet
node build.js
open dist/install.html
```

Page install.html bakal kebuka di browser. Drag tombol-tombol dari sana ke bookmark bar lu.

#### Trigger

Klik bookmark di page checkout mana aja. Toast kecil muncul di pojok kanan atas dengan jumlah field yang kepasang.

---

### 3D — Playwright CLI (Node)

Automated testing, paling reliable karena bypass cross-origin via CDP. Bisa tembus ke semua iframe Stripe.

#### Install

```sh
cd playwright
npm install
npx playwright install chromium
```

#### Jalankan

```sh
# Cuma isi, ga submit
node autofill.js --url https://your-site.test/checkout --profile us_01

# Isi + submit
node autofill.js --url https://your-site.test/checkout --profile us_01 --submit

# Liat browser-nya (headful, jendela ga ke-close)
node autofill.js --url https://... --profile us_01 --headful

# Pake Chrome beneran (bukan Chromium bundled)
node autofill.js --url https://... --channel chrome

# Tunggu lebih lama kalau page-nya lemot (SPA, dll)
node autofill.js --url https://... --wait 8000
```

#### Output yang diharapkan

```
[autofill] profile="us_01" submit=false url=...
[autofill] per-frame results:
  ✓ https://.../checkout
    filled: cardNumber, cardHolder, cardCvc, cardExpiry, country, line1, city, state, postalCode
    missed: email, phone, line2
[autofill] submit: clicked
```

`missed` itu field yang ga ada di page target atau lu kosongin di profile. Bukan error.

---

### 3E — Playwright CLI (Python)

Sama persis flags-nya, sama persis behaviour-nya. Pilih ini kalau stack lu Python.

#### Install

```sh
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
```

#### Jalankan

```sh
python autofill.py --url https://your-site.test/checkout --profile us_01 --submit
```

Semua flag identik sama Node version.

---

## Step 4 — Troubleshooting

### "missed: cardNumber" di page yang jelas-jelas ada card field

Kemungkinan field-nya ada di cross-origin iframe. Liat tabel:

| Tipe site | Work dengan |
|---|---|
| Stripe Elements (iframe dari `js.stripe.com`) | Playwright CLI, extension, userscript — **BUKAN bookmarklet** |
| Stripe Checkout page (`checkout.stripe.com`) | Semua metode |
| Shopify Plus / Woocommerce native | Semua metode |

Debug dengan buka DevTools console, jalanin:

```js
window.__AutoFill.fill({ card: { number: 'test' } }, { root: document })
```

Kalau outputnya `missed: ['cardNumber']`, selector list butuh ditambahin. Buka issue dengan URL site atau screenshot DOM inspector-nya.

### Floating button di extension ga muncul

Button cuma muncul kalau engine detect minimal 2 dari 3 field: `cardNumber`, `cardHolder`, `cardCvc`. Kalau checkout-nya lazy-load (card fields muncul setelah klik "Continue to payment"), tunggu sampe kebuka trus pake keyboard shortcut `Ctrl+Shift+F`.

### Submit button ga ke-klik setelah `--submit`

Engine cari `button[type="submit"]` atau `button` yang text-nya match `/pay|submit|confirm|continue|checkout|subscribe|buy/i`. Kalau button-nya custom element atau pake text aneh, ga ke-detect. Workaround:
- Tambah `--headful` untuk liat kenapa engine mutusin ga klik
- Klik submit manual
- Buka issue dengan outer HTML tombolnya — biasanya tinggal nambah 1 selector

### React form kosong lagi setelah fill

Engine pake `_valueTracker` hack buat bypass React synthetic event. Kalau site pake Formik dengan custom wrapper yang aneh, hack-nya kadang ga jalan. Biasanya extra focus+blur di field udah cukup — kalau masih gagal, itu bug di engine, buka issue dengan URL site-nya.

### Chrome 129+ nolak `--load-extension` pas automated testing

Chrome 129 restrict `--load-extension` ke enterprise policy. Extension tetep work kalau di-install manual via `chrome://extensions/` → **Load unpacked**. Cuma Playwright automated test yang perlu pake Chromium bundled (bukan Chrome installed).

### Test card ke-decline di live Stripe Checkout

Itu expected. Stripe test card (`4242...`) auto-reject di endpoint `cs_live_`. Kalau mau end-to-end success, pake test mode:

- Ambil `sk_test_...` key dari Stripe dashboard lu
- Bikin test-mode Checkout Session via Stripe API atau dashboard
- URL-nya mulai dengan `cs_test_...`
- Test card di sana success semua

---

## Step 5 — Field mapping reference

Ini pemetaan antara field di profile lu dan selector yang engine coba. Kalau lu mau nambah selector baru, edit `core/autofill-engine.js`:

| Field profile | Dicocokin ke |
|---|---|
| `card.number` | `autocomplete="cc-number"`, `name="cardnumber"`, `data-elements-stable-field-name="cardNumber"` |
| `card.expMonth` + `card.expYear` | Combined `cc-exp` atau split `cc-exp-month` + `cc-exp-year` |
| `card.cvc` | `cc-csc`, `name="cvc"`, `aria-label="CVC"` |
| `card.holder` | `cc-name`, `name="ccname"`, `name_on_card` |
| `billing.email` | `type="email"`, `name="email"`, `billingEmail` |
| `billing.phone` | `type="tel"`, `name="phone"`, `billingPhone` |
| `billing.country` | `autocomplete="country"`, `autocomplete="billing country"`, `name="billingCountry"` |
| `billing.line1` | `autocomplete="address-line1"`, `name="billingAddressLine1"` |
| `billing.line2` | `autocomplete="address-line2"`, `name="billingAddressLine2"` |
| `billing.city` | `autocomplete="address-level2"`, `name="billingLocality"` |
| `billing.state` / `stateCode` | `autocomplete="address-level1"`, `name="billingAdministrativeArea"` — engine coba `stateCode` dulu (untuk `<select value="CA">`), trus fallback ke `state` (untuk `<select value="California">`) |
| `billing.postalCode` | `autocomplete="postal-code"`, `name="billingPostalCode"` |

Full list selector ada di `core/autofill-engine.js` di bawah object `SELECTORS`.

---

## Step 6 — Multi-identity workflow (batch mode)

Kalau lu mau run **satu URL dengan banyak identity berbeda berturut-turut** (fokus US misalnya), pake batch mode di `./autofill`. Tiap iterasi pake profile berbeda dari `profiles.json`.

### 6A — Generate banyak profile sekali

```sh
cd python && source .venv/bin/activate

# Generate 50 US profile (cards cycle through 10 Stripe test cards, identity semua unique)
python gen-profiles.py --count 50 --force --out ../profiles.json

# Atau 100
python gen-profiles.py --count 100 --force --out ../profiles.json
```

Setiap profile punya nama, email, alamat, state + ZIP yang berbeda dan unique. Stripe test card cycle tiap 10 (us_01 = Visa, us_02 = Visa debit, ... us_11 = Visa lagi, dst).

### 6B — Batch run — tiga cara

**Cara 1: Specific list**
```sh
./autofill https://your-site.test/checkout --profiles us_01,us_05,us_10 --submit
```
Run 3 kali pake 3 identity yang lu sebutin.

**Cara 2: First N profiles**
```sh
./autofill https://your-site.test/checkout --count 5 --submit
```
Run 5 kali pake `us_01`..`us_05`.

**Cara 3: Semua profile**
```sh
./autofill https://your-site.test/checkout --all --submit
```
Run setiap profile di `profiles.json`.

### 6C — Control timing

```sh
# Default sleep 2 detik antar run. Kecilin kalau mau cepet:
./autofill <url> --all --sleep 0.5 --submit

# Atau lebih lama kalau server lu rate-limit:
./autofill <url> --all --sleep 10 --submit
```

### 6D — Contoh output batch

```
▶ Batch run: 5 profile(s) against https://your-site.test/checkout
  us_01
  us_02
  us_03
  us_04
  us_05

━━━ [1/5] us_01 ━━━
[autofill] profile="us_01" submit=true url=...
    filled: cardNumber, cardHolder, cardCvc, cardExpiry, country, line1, city, state, postalCode
    missed: email, phone, line2
[autofill] submit: clicked
━━━ [2/5] us_02 ━━━
...

━━━ Batch summary ━━━
  ok:     5 / 5
```

Kalau ada profile yang fail (network error, selector miss, etc), summary-nya akan kelihatan:

```
━━━ Batch summary ━━━
  ok:     3 / 5
  failed: us_02 us_04
```

### 6E — Kombinasi workflow

Common pattern:

```sh
# Step 1: generate 20 US identity fresh
python/gen-profiles.py --count 20 --force --out profiles.json

# Step 2: run all 20 against your checkout with auto-submit
./autofill https://your-site.test/checkout --all --submit --sleep 3

# Step 3: review summary, check mana yang fail
```

### 6F — Multi-file workflow (advanced)

Kalau lu mau punya multiple "set" buat testing yang berbeda:

```sh
# Set A untuk US test
python gen-profiles.py --count 20 --seed 1 --out ../profiles-us.json

# Set B untuk smoke test kecil
python gen-profiles.py --count 3 --seed 2 --out ../profiles-smoke.json
```

Default `./autofill` baca `profiles.json`. Untuk pake file lain: rename ke `profiles.json`, atau edit path di `playwright/autofill.js` baris 18 / `python/autofill.py` baris 20.

---

## Step 7 — Kontribusi selector baru

Kalau nemu site yang engine miss, cara termudah nambahin:

1. Buka `core/autofill-engine.js`
2. Scroll ke object `SELECTORS`
3. Tambah selector baru di array field yang relevan. Urut paling spesifik di atas.
4. Copy updated `core/autofill-engine.js` ke `extension/autofill-engine.js` biar extension kepick up juga:
   ```sh
   cp core/autofill-engine.js extension/autofill-engine.js
   ```
5. Test via Playwright CLI dulu untuk pastiin:
   ```sh
   cd playwright
   node autofill.js --url <site-url> --profile us_01
   ```
6. Commit + push.

---

## Release notes

- **v0.2.0** (current) — Python CLI, simpler extension UX, profile generator, tutorial
- **v0.1.0** — Initial release dengan 4 delivery methods

Changelog lengkap: [CHANGELOG.md](CHANGELOG.md)

---

## Troubleshooting cepat

```
❓ Profile ga kepick up            → Restart extension atau refresh page
❓ Command not found: gen-profiles → `source .venv/bin/activate` dulu
❓ Playwright error "executable"   → `npx playwright install chromium`
❓ Faker error import              → `pip install -r python/requirements.txt`
❓ Extension ga keliatan di Chrome → chrome://extensions → Load unpacked
❓ Bookmarklet ga jalan di Stripe  → Expected. Pake extension/userscript/CLI
```

---

## Bantuan lebih lanjut

- **Quick reference English**: [USAGE.md](USAGE.md)
- **Repository**: https://github.com/nopperabbo/auto-fill
- **Issues**: https://github.com/nopperabbo/auto-fill/issues
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
