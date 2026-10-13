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
| `api-panel.js` | Buttons for Cookiebot / UC_UI calls + result log (EUD-4697..4700, 4874..4879) |
| `csp-checker.js` | CSP violation list + nonce audit |

Notes
- Banner script must stay in the `<head>`, before any other tracker.
- CSP pages: no inline scripts/styles/handlers, otherwise the page itself causes violations.
- GitHub Pages cannot send headers, so CSP is set via `<meta>` with a fixed nonce.
