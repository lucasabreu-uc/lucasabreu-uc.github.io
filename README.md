# Cookiebot banner test lab

Static test site (GitHub Pages) for manual banner testing.

| Page | Purpose |
|---|---|
| `index.html` / `trial.html` / `freemium.html` | One page per plan, each with its own banner script (cbid) |
| `csp-strict.html` | Strict nonce-only CSP (EUD-6150/6151/6152/6244) |
| `csp-none.html` | Control page without CSP (EUD-6153) |

| File | Purpose |
|---|---|
| `status.js` | Consent status panel, cookie declaration, clear-consent tools |
| `lab-ui.js` | Shared DOM helpers for the panels below |
| `inspector.js` | Cookies, localStorage, TC / GACM / USP / GPP strings, GPC (EUD-6156/6157/6158) |
| `api-panel.js` | Buttons for `Cookiebot.*` calls + result log |
| `a11y-panel.js` | Banner accessibility: axe-core, static audit, focus tracker, text spacing / zoom / 320px reflow, environment info |
| `vendor/axe.min.js` | axe-core 4.10.2, loaded on demand by `a11y-panel.js` (local copy so the strict CSP allows it) |
| `context-panel.js` | Test Context: browser / bot hints, GPC, regulation, country, page |
| `event-log.js` | Records every `CookiebotOn*` event from page start (load it in `<head>` BEFORE the banner script) |
| `events-panel.js` | Event Log panel + JSON export (log and full report for Xray) |
| `csp-checker.js` | CSP violation list + nonce audit |

Notes
- After changing a `.js` file, bump the `?v=` on its `<script>` tags in the pages, otherwise browsers keep the cached copy (GitHub Pages caches for 10 min).
- Banner script must stay in the `<head>`, before any other tracker.
- CSP pages: no inline scripts/styles/handlers, otherwise the page itself causes violations.
- GitHub Pages cannot send headers, so CSP is set via `<meta>` with a fixed nonce.
