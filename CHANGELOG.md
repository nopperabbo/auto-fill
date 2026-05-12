# Changelog

All notable changes to this project will be documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org).

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
