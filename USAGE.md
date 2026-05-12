# Usage Guide

Step-by-step tutorial for every delivery method. Pick the one that matches how you work.

> **Testing-only tool.** Use on forms you own or on Stripe test-mode sessions. Stripe test cards are documented at https://stripe.com/docs/testing.

---

## Step 0 — One-time setup (pick one)

### Option A — Generate 10 US profiles automatically

Fastest way to get started. Runs Faker once, writes 10 realistic US profiles paired with the 10 major Stripe test cards (Visa, Mastercard, Amex, Discover, JCB, Diners Club, plus debit variants).

```sh
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python gen-profiles.py --out ../profiles.json
```

Options:
- `--count 5` — generate fewer than 10 (min 1, max 10)
- `--seed 42` — reproducible output (same data every time)
- `--force` — overwrite `profiles.json` if it already exists
- `--out <path>` — write to a different file

Output: `profiles.json` with keys `us_01` through `us_10`. Each entry includes name, email, phone, US street address with matching state + ZIP, and one Stripe test card. Default profile is `us_01`.

### Option B — Write your own profile by hand

```sh
cp profiles.example.json profiles.json
```

Edit `profiles.json`. Minimum viable entry:

```json
{
  "defaultProfile": "mine",
  "profiles": {
    "mine": {
      "card": {
        "number": "4242 4242 4242 4242",
        "expMonth": "12",
        "expYear": "34",
        "cvc": "123",
        "holder": "Your Name"
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

Every field is optional — the engine only fills what the target form has.

---

## Method 1 — Playwright CLI (Node)

Most reliable. Fills top-frame and every nested iframe (including cross-origin Stripe Elements). Use for end-to-end testing a checkout flow programmatically.

### Install

```sh
cd playwright
npm install
npx playwright install chromium
```

### Run

```sh
# Fill only
node autofill.js --url https://your-site.test/checkout --profile us_01

# Fill and submit
node autofill.js --url https://your-site.test/checkout --profile us_01 --submit

# See what is happening (opens visible browser, leaves it open)
node autofill.js --url https://your-site.test/checkout --profile us_01 --headful

# Use your installed Chrome instead of bundled Chromium
node autofill.js --url ... --channel chrome

# Wait longer after page load (slow SPAs)
node autofill.js --url ... --wait 8000
```

### Expected output

```
[autofill] profile="us_01" submit=false url=...
[autofill] per-frame results:
  ok https://.../checkout
    filled: cardNumber, cardHolder, cardCvc, cardExpiry, country, line1, city, state, postalCode
    missed: email, phone, line2
[autofill] submit: clicked
```

`missed` entries are either (a) fields that don't exist on the target page, or (b) fields your profile left empty. Both are fine.

---

## Method 2 — Playwright CLI (Python)

Same flags, same behavior as Node. Use if your stack is Python.

### Install

```sh
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
```

### Run

```sh
python autofill.py --url https://your-site.test/checkout --profile us_01 --submit
```

All flags identical to Node version.

---

## Method 3 — Chrome / Edge extension

Once installed, it is one click or one keystroke on any checkout page.

### Install

1. Open `chrome://extensions/`
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repo
5. Pin the extension: click the puzzle-piece icon then push-pin next to **Auto Fill**

### Load profiles into the extension

Extension stores profiles in `chrome.storage.local`, separately from `profiles.json`. To import:

1. Click the **Auto Fill** icon
2. Click **Edit profiles JSON**
3. Paste the contents of your `profiles.json`
4. Click **Save**

The dropdown now lists all your profiles. Refresh any open checkout page.

### Four ways to trigger a fill

| Method | How | Notes |
|---|---|---|
| Floating button | Appears on pages with a detected payment form | One click fills, "+ Submit" button also submits, close with X |
| Keyboard shortcut (fill) | `Ctrl+Shift+F` (Cmd on macOS) | Default profile, fill only |
| Keyboard shortcut (fill+submit) | `Ctrl+Shift+X` | Default profile, also submits |
| Right-click menu | Right-click on page then **Auto Fill** > **Fill — profile** | Pick any saved profile |

Rebind shortcuts at `chrome://extensions/shortcuts`.

### Change default profile

In the popup, pick a profile in the dropdown then click **Fill** once. Or edit the JSON and change `defaultProfile` to the key you want.

---

## Method 4 — Tampermonkey userscript

For Firefox (or Chrome users who prefer Tampermonkey over extension install). Auto-injects into top-frame and Stripe iframes.

### Install

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Open `userscript/autofill.user.js` in this repo. Tampermonkey prompts to install it.
3. Load profiles: Tampermonkey icon menu then **Edit profiles (JSON)** then paste contents of `profiles.json` then save.

### Trigger

Tampermonkey icon on any page gives a submenu:
- **Fill — `<profile>`** (one entry per profile)
- **Fill + Submit — `<profile>`**
- **Edit profiles (JSON)**

---

## Method 5 — Bookmarklet

Simplest, no install. Works on plain HTML and same-origin React forms. **Does not work in Stripe iframes** (cross-origin sandbox — this is a browser policy, not a bug).

### Install

```sh
cd bookmarklet
node build.js
open dist/install.html
```

Drag the buttons from `install.html` onto your browser bookmarks bar.

### Trigger

Click the bookmark on any checkout page. A toast appears top-right showing fill count.

---

## Troubleshooting

### "missed: cardNumber" on a site that clearly has a card field

The field might be inside a cross-origin iframe that your delivery method cannot reach:

| Site type | Works with |
|---|---|
| Stripe Elements (iframe from js.stripe.com) | Playwright CLI, extension, userscript — NOT bookmarklet |
| Stripe Checkout page (checkout.stripe.com) | All methods |
| Shopify Plus / Woocommerce native | All methods |

Dump what the engine found by opening DevTools console after a fill attempt and running:

```js
window.__AutoFill.fill(
  { card: { number: 'x' } },
  { root: document }
);
```

If the console shows an error or returns `missed: ['cardNumber']`, the selector list needs expanding. Open an issue with the site URL (or a screenshot of the DOM inspector showing the input attributes) and we can add the selector.

### Extension floating button does not appear

The button shows only when the engine detects at least 2 of `cardNumber`, `cardHolder`, `cardCvc` on the page. If your checkout loads card fields lazily (after user clicks "Continue to payment"), wait for them to appear then use the keyboard shortcut (`Ctrl+Shift+F`) instead.

### Submit button not clicked after `--submit`

The engine looks for a `button[type="submit"]` or any `button` whose text matches `/pay|submit|confirm|continue|checkout|subscribe|buy/i`. If the site uses a custom element or non-standard text, the button is not found. Workarounds:
- Add `--headful` to see the page state when the engine decides not to click
- Click submit manually after fill
- Open an issue with the button's outer HTML — a simple selector addition usually fixes it

### React form fields revert to empty after fill

The engine uses the `_valueTracker` hack to bypass React's synthetic event system. If a site uses Formik's `setFieldValue` with custom wrappers, the trick might not propagate. Usually triggering an extra focus + blur on the field works — this is a bug to fix in the engine, open an issue with the site URL.

### Extension does not load in Chrome 129+

Chrome 129 restricted `--load-extension` to enterprise policy. The extension works fine when installed via `chrome://extensions/` > **Load unpacked**. Automated testing via Playwright needs the bundled Chromium (not installed Chrome) — see `playwright.config` docs.

### Card declined on live Stripe Checkout with test card

Expected. Stripe test cards (`4242...` etc) are rejected at the `live_` endpoint. Use Stripe test mode for end-to-end success:

- Get a `sk_test_...` key from your Stripe dashboard
- Create a test-mode Checkout Session via the Stripe API or dashboard
- The session URL will start with `cs_test_...`
- Test cards succeed there

---

## Generate multiple profile files for different test scenarios

```sh
# A set for US-only tests
python gen-profiles.py --count 10 --seed 1 --out ../profiles-us.json

# A smaller set for quick smoke tests
python gen-profiles.py --count 3 --seed 2 --out ../profiles-smoke.json
```

Point any delivery method at a specific file by setting the `PROFILES` environment variable or passing `--profiles` (Playwright CLI reads from `profiles.json` by convention — edit the path in `playwright/autofill.js` line 18 if you want another default).

---

## What gets filled

Every profile field maps to one detection strategy. Field detection is layered: most-specific selector wins, then falls back through WHATWG autocomplete, common `name=` attributes, `aria-label`, and `placeholder`.

| Profile field | Fills fields matching (examples) |
|---|---|
| `card.number` | `autocomplete="cc-number"`, `name="cardnumber"`, `data-elements-stable-field-name="cardNumber"` |
| `card.expMonth` + `card.expYear` | combined `cc-exp` or split `cc-exp-month` + `cc-exp-year` |
| `card.cvc` | `cc-csc`, `name="cvc"`, `aria-label="CVC"` |
| `card.holder` | `cc-name`, `name="ccname"`, `name_on_card` |
| `billing.email` | `type="email"`, `name="email"`, `billingEmail` |
| `billing.phone` | `type="tel"`, `name="phone"`, `billingPhone` |
| `billing.country` | `autocomplete="country"`, `autocomplete="billing country"`, `name="billingCountry"` |
| `billing.line1` | `autocomplete="address-line1"`, `name="billingAddressLine1"` |
| `billing.line2` | `autocomplete="address-line2"`, `name="billingAddressLine2"` |
| `billing.city` | `autocomplete="address-level2"`, `name="billingLocality"` |
| `billing.state` / `stateCode` | `autocomplete="address-level1"`, `name="billingAdministrativeArea"` — tries `stateCode` first (for `<select value="CA">`), then `state` (for `<select value="California">`) |
| `billing.postalCode` | `autocomplete="postal-code"`, `name="billingPostalCode"` |

Full selector lists are in `core/autofill-engine.js` under `SELECTORS`.
