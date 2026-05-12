# Auto Fill — Payment Forms

Five ways to auto-fill payment forms (Stripe Elements, Stripe Checkout, plain HTML, React) from a local JSON profile.

All methods share one core engine (`core/autofill-engine.js`) that uses proven patterns from production autofill tools (refined-github, Automa, Firefox iOS, Bitwarden, Stripe e2e suites).

## Quick start (30 seconds)

```sh
git clone https://github.com/nopperabbo/auto-fill.git
cd auto-fill
./setup.sh                                          # installs deps + generates profiles.json
./autofill https://your-site.test/checkout --submit # fill + submit, done
```

`setup.sh` handles Python venv, Node deps, Playwright Chromium, and generates 10 US profiles with Stripe test cards. `autofill` wrapper auto-picks Node or Python backend.

## Other install methods

<details>
<summary>Manual profile setup</summary>

```sh
cp profiles.example.json profiles.json   # start from example
# or
cd python && source .venv/bin/activate
python gen-profiles.py --out ../profiles.json   # generate 10 US entries
```

</details>

<details>
<summary>Chrome extension / Tampermonkey / Bookmarklet</summary>

See [TUTORIAL.md](TUTORIAL.md) Step 3 for each method.

</details>

`profiles.json` is `.gitignore`d — never commit real card data.

**📘 Tutorial lengkap (Bahasa Indonesia, step-by-step): [TUTORIAL.md](TUTORIAL.md)**
**📗 English quick reference: [USAGE.md](USAGE.md)**

## Profile shape

```json
{
  "defaultProfile": "personal",
  "profiles": {
    "personal": {
      "label": "My Card",
      "card": {
        "number": "4242 4242 4242 4242",
        "expMonth": "12",
        "expYear": "34",
        "cvc": "123",
        "holder": "Your Name"
      },
      "billing": {
        "email": "you@example.com",
        "phone": "+1 555 0100",
        "country": "ID",
        "countryName": "Indonesia",
        "line1": "Street",
        "line2": "Unit",
        "city": "Jakarta",
        "state": "DKI Jakarta",
        "stateCode": "JK",
        "postalCode": "12190"
      }
    }
  }
}
```

Fields are all optional — engine only fills what matches. `expYear` accepts `"34"` or `"2034"`.

---

## 1. Playwright CLI (Node or Python — most reliable)

Fills top-frame AND Stripe iframes by bypassing same-origin via CDP. Same behavior in both languages — pick whichever stack you prefer.

### Node

```sh
cd playwright
npm install
npx playwright install chromium

node autofill.js --url https://example.com/checkout --profile personal --submit
```

### Python

```sh
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium

python autofill.py --url https://example.com/checkout --profile personal --submit
```

Flags (same for both):

- `--url <url>`            target page (required)
- `--profile <key>`        profile key (default: `defaultProfile` in JSON)
- `--submit`               click the pay/submit button after filling
- `--headful`              show the browser window, leaves it open
- `--channel chrome`       use installed Chrome instead of bundled Chromium
- `--wait <ms>`            delay after page load before filling (default 3000)

## 2. Chrome / Edge extension — simplest daily driver

Fills top-frame AND all iframes via `all_frames: true` content script. Four ways to trigger:

1. **Floating "Fill" button** appears automatically when a payment form is detected on the page — one click fills, "+ Submit" variant also submits.
2. **Keyboard shortcut** `Ctrl+Shift+F` (Cmd on macOS) fills with default profile. `Ctrl+Shift+X` fills and submits.
3. **Right-click menu** on any page: `Auto Fill → Fill — <profile>` lists all saved profiles.
4. **Popup** (puzzle-piece icon or `Ctrl+Shift+Y`) for explicit profile selection + inline JSON editor.

### Install

```
chrome://extensions → Developer mode → Load unpacked → select ./extension
```

Click the puzzle-piece → pin **Auto Fill**. Edit profiles in the popup: **Edit profiles JSON** → paste → **Save**. Shortcuts can be customized at `chrome://extensions/shortcuts`.

## 4. Tampermonkey userscript

Auto-injects into top-frame AND Stripe iframes (via explicit `@match https://js.stripe.com/*`).

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Install `userscript/autofill.user.js` — open the file, Tampermonkey prompts.
3. On any payment page: Tampermonkey icon → `Fill — <profile>` or `Fill + Submit — <profile>`.
4. Edit profiles: Tampermonkey icon → `Edit profiles (JSON)`.

## 5. Bookmarklet (simplest, but limited)

Works on plain HTML and same-origin React forms. **Cannot fill Stripe iframes** (cross-origin sandbox).

```sh
node bookmarklet/build.js
open bookmarklet/dist/install.html
```

Drag the buttons onto your bookmarks bar. Click on any payment page to fill.

---

## Delivery method matrix

|                          | Plain HTML | React (same-origin) | Stripe Elements iframe | Stripe Checkout page |
|--------------------------|------------|---------------------|------------------------|----------------------|
| Playwright CLI (Node)    | ✅          | ✅                   | ✅                      | ✅                    |
| Playwright CLI (Python)  | ✅          | ✅                   | ✅                      | ✅                    |
| Chrome extension         | ✅          | ✅                   | ✅                      | ✅                    |
| Tampermonkey userscript  | ✅          | ✅                   | ✅                      | ✅                    |
| Bookmarklet              | ✅          | ✅                   | ❌ (same-origin policy) | ✅ (top-frame)        |

## Security notes

- `profiles.json` stores card numbers in plaintext. **Do not commit.** `.gitignore` already blocks it along with `*.pem`, `*.crx`, and `.env.*`.
- Extension profile data lives in `chrome.storage.local` — cleared when extension is removed.
- Userscript profile data lives in Tampermonkey's `GM_setValue` storage — per-browser, not synced by default.
- This tool is for your own cards on your own devices. Don't use it to fill forms you don't own.
- `4242 4242 4242 4242` and `4111 1111 1111 1111` in the example file are public Stripe test cards — use them for smoke tests.
- Bookmarklets **cannot** reach Stripe Elements iframes due to cross-origin sandbox policy. This is a browser security boundary, not a bug. Use the extension, userscript, or Playwright CLI for Stripe Elements.

## How it works

The core engine uses three techniques that together handle virtually every payment form:

1. **Native prototype setter** — `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, val)`. React monkey-patches the setter for its `_valueTracker`; calling the original bypasses that.
2. **`_valueTracker.setValue(prev)` hack** — forces React's next diff to detect a change even if the rendered value already matches. Credit: [facebook/react#11488](https://github.com/facebook/react/issues/11488).
3. **`input → change → blur` event sequence** — triggers React onChange, React Hook Form / Formik validation, and touched-state flags in order.

Selectors are layered most-specific-first: `data-elements-stable-field-name` (Stripe's official stable API) → `autocomplete="cc-*"` (WHATWG spec) → `name=` attrs → `aria-label` / `placeholder` fuzzy match.

## Verified against

- Plain HTML form (test-fixtures/plain-form.html) — combined MM/YY
- Plain HTML form — split MM/YY via `?split=1`
- React 18 controlled form with `<select>` (test-fixtures/react-form.html)
- Extension loaded unpacked in Chromium: Shadow DOM widget rendered, content script fills 10/10 fields on plain-form fixture

Run any of them:
```sh
# Node
cd playwright
node autofill.js --url "file://$PWD/../test-fixtures/plain-form.html" --profile test --submit
node autofill.js --url "file://$PWD/../test-fixtures/plain-form.html?split=1" --profile test
node autofill.js --url "file://$PWD/../test-fixtures/react-form.html" --profile test --submit --wait 2500

# Python
cd python && source .venv/bin/activate
python autofill.py --url "file://$PWD/../test-fixtures/plain-form.html" --profile test --submit
```

## Layout

```
.
├── profiles.example.json    template (safe to commit)
├── profiles.json            your real data (gitignored)
├── core/autofill-engine.js  the shared engine
├── bookmarklet/             drag-to-bookmark install page generator
├── extension/               Chrome/Edge MV3 extension (floating button, shortcuts, context menu)
├── userscript/              Tampermonkey single-file script
├── playwright/              Node CLI + Playwright runtime
├── python/                  Python CLI + Playwright runtime
└── test-fixtures/           HTML files for smoke tests
```

## Credits

This engine wouldn't work without the pattern discoveries baked into these projects and threads:

- **[refined-github](https://github.com/refined-github/refined-github)** — `source/helpers/set-react-input-value.ts` — canonical native-prototype-setter pattern for React inputs.
- **[AutomaApp/automa](https://github.com/AutomaApp/automa)** — `src/utils/handleFormElement.js` — full form-element handler including the `_valueTracker.setValue()` trick that forces React diff detection.
- **[mozilla-mobile/firefox-ios](https://github.com/mozilla-mobile/firefox-ios)** — `LoginsHelper.js` — `input → change → blur` event sequence that triggers React Hook Form / Formik validation and touched state.
- **[remix-project](https://github.com/remix-project-org/remix-project)** — e2e suite — `HTMLSelectElement.prototype` setter pattern (different from input).
- **[freeCodeCamp](https://github.com/freeCodeCamp/freeCodeCamp)**, **[woocommerce-gateway-stripe](https://github.com/woocommerce/woocommerce-gateway-stripe)**, **[useautumn/autumn](https://github.com/useautumn/autumn)** — e2e test suites demonstrating `data-elements-stable-field-name` selectors for Stripe iframes.
- **[bitwarden/clients](https://github.com/bitwarden/clients)** — `autofill-inline-menu-content.service.ts` — Shadow DOM floating UI pattern with `all: initial` host styles, randomized custom tag, MutationObserver throttle bailout, and `contextMenus` rebuild-on-change pattern.
- **[gildas-lormeau/SingleFile](https://github.com/gildas-lormeau/SingleFile)** — element-based dedup pattern (`querySelector(TAGNAME)` instead of `window.__flag`) that survives SPA re-injection.
- **[facebook/react#11488](https://github.com/facebook/react/issues/11488)** — the React issue thread that documents the synthetic-event + `_valueTracker` mechanism and why the native setter is required.
- **Stripe** — for exposing `data-elements-stable-field-name` as a stable API on Elements inputs.

## License

[Unlicense](LICENSE) — public domain. Do whatever you want with this.
&nbsp;

Maintained by the Auto Fill Contributors.
