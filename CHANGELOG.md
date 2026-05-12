# Changelog

All notable changes to this project will be documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org).

## [0.2.0] — 2026-05-12

### Added — Python CLI
- **Python port** (`python/autofill.py`) — 1:1 port of `playwright/autofill.js`. Same flags (`--url`, `--profile`, `--submit`, `--headful`, `--channel`, `--wait`), same frame-scan strategy, same injected engine. Uses `playwright` Python async API.
- `python/requirements.txt` pins `playwright>=1.55.1,<2.0`. `.gitignore` now excludes `python/.venv/` and Python cache dirs.

### Changed — Chrome extension UX (major upgrade)
- **Floating "Fill" button** — auto-appears on pages with a detected payment form (≥2 of cardNumber/holder/cvc present). Uses Shadow DOM with randomized custom tag name (`auto-fill-widget-7k2x9`) and `all: initial` host styles so hostile site CSS can't disable it. Pattern sourced from Bitwarden's autofill inline menu.
- **Keyboard shortcuts** via `commands` API:
  - `Ctrl+Shift+F` (⌘+Shift+F on macOS) — fill with default profile
  - `Ctrl+Shift+X` — fill and submit
  - `Ctrl+Shift+Y` — open popup
  - Rebindable at `chrome://extensions/shortcuts`.
- **Right-click context menu** — `Auto Fill → Fill / Fill + Submit → <profile>` lists every saved profile. Auto-rebuilds on `chrome.storage.onChanged` events.
- **Form detection** via MutationObserver with Bitwarden's runaway-guard (bail after >100 callbacks in 2s).
- **Element-based dedup** (`querySelector(WIDGET_TAG)`) instead of `window.__flag` — survives SPA `history.pushState` and content script re-execution.
- Popup stays compatible; added `autofill:listProfiles` message type for programmatic profile enumeration.

### Changed — manifest.json
- Bumped `version` to `0.2.0`.
- Added permissions: `contextMenus`.
- Added `commands` block with three shortcuts.

### Credits added
- [bitwarden/clients](https://github.com/bitwarden/clients) — Shadow DOM floating UI pattern, MutationObserver throttle, contextMenus rebuild pattern.
- [gildas-lormeau/SingleFile](https://github.com/gildas-lormeau/SingleFile) — element-based dedup pattern.

### Added — Profile generator + tutorial
- **`python/gen-profiles.py`** — one-shot generator that populates `profiles.json` with 10 realistic US profiles using Faker, each paired with one of the 10 major Stripe public test cards (Visa, Mastercard, Amex, Discover, JCB, Diners Club, debit variants). Options: `--count`, `--seed`, `--out`, `--force`. Not a runtime randomizer — run once, edit output by hand thereafter.
- **`USAGE.md`** — complete step-by-step tutorial for every delivery method (Playwright Node/Python, extension, userscript, bookmarklet) including troubleshooting section and field-mapping reference table.
- `faker>=30.0,<40.0` added to `python/requirements.txt`.

### Fixed — Stripe Checkout selector coverage
- Added `autocomplete="billing <field>"`-prefixed selectors for country, line1/2, city, state, postalCode, email, phone. Stripe Checkout uses the "billing " prefix on `autocomplete` attributes which our v0.1.0 selectors missed.
- Added `select[name="billingAdministrativeArea"]` for Stripe's province picker.
- **Verified on live Stripe Checkout session** (user's own): 10/10 fields filled (email/phone correctly absent on that session), submit button clicked successfully — validator accepted all values.

### Verified
- Python: 10 fields filled on plain-form fixture + 9 on React fixture with `useState` snapshot confirming React state updates.
- Extension: floating widget renders on plain-form fixture; service worker starts; full fill pipeline (SW → content script → engine) fills 10/10 expected fields with DOM values matching profile exactly.

## [0.1.0] — 2026-05-12

### Added
- **Core engine** (`core/autofill-engine.js`) with layered selector strategy for Stripe Elements, Stripe Checkout, plain HTML, and React forms.
- **React-controlled input support** via native prototype setter + `_valueTracker.setValue()` + `input → change → blur` event sequence.
- **Expiry handling** for combined (`MM / YY`) and split (`cc-exp-month` / `cc-exp-year`) layouts, including `<select>` with 4-digit years.
- **Country / province `<select>`** fuzzy matching by value, text, substring, or ISO-2 code.
- **Playwright CLI** (`playwright/autofill.js`) — fills top-frame and all nested frames (including cross-origin Stripe iframes) via CDP. Flags: `--url`, `--profile`, `--submit`, `--headful`, `--channel`, `--wait`.
- **Chrome / Edge extension** (MV3) — content script with `all_frames: true` + per-frame dispatch via `chrome.webNavigation.getAllFrames`. Popup with profile picker + inline JSON editor.
- **Tampermonkey userscript** — `@match` includes `js.stripe.com` so injection reaches Stripe iframes. Top frame broadcasts fill via `postMessage`; iframe instances listen and fill their own inputs. Multi-profile menu commands.
- **Bookmarklet** — `bookmarklet/build.js` bundles engine + profile, minifies, emits drag-to-bookmark install page. (Cannot cross same-origin sandbox, honest about it.)
- **Test fixtures**: `test-fixtures/plain-form.html` (combined + split-expiry variants) and `test-fixtures/react-form.html` (React 18 controlled with `<select>`).
- **Verification**: engine verified end-to-end against all three fixtures — React `useState` snapshot on submit confirms the `_valueTracker` trick works, not just visual DOM.

### Security
- `profiles.json` gitignored; example file ships with Stripe public test cards (`4242 4242 4242 4242`, `4111 1111 1111 1111`), `example.com` emails, NANP fictional phone numbers (`+1 555 01XX`), and `John Doe` placeholder holder.
- `.gitignore` blocks `*.pem`, `*.crx` (extension signing keys), `.env.*`, Playwright artifacts, and tool metadata dirs.

### Pattern credits
- `refined-github/source/helpers/set-react-input-value.ts` — canonical native-setter pattern
- `AutomaApp/automa/src/utils/handleFormElement.js` — `_valueTracker.setValue()` full-power form handler
- `mozilla-mobile/firefox-ios` LoginsHelper — `input → change → blur` sequence for validation libraries
- `remix-project-org/remix-project` e2e — `HTMLSelectElement.prototype` setter pattern
- `freeCodeCamp`, `woocommerce-gateway-stripe`, `useautumn/autumn` e2e — `data-elements-stable-field-name` Stripe selectors
- [facebook/react#11488](https://github.com/facebook/react/issues/11488) — React synthetic event system + `_valueTracker` mechanism
