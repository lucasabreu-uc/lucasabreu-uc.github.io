// ITEM 6 - Test Context
// Mount point: <div id="test-context"></div>
// Read-only: in which conditions is this test running? Browser / automation hints,
// privacy signals (GPC, DNT), what Cookiebot reports (regulations, country, consent id)
// and the page. Properties a banner does not expose show "n/a" (that is information too).
// Viewport and prefers-* live in the Accessibility panel; cookie/storage detail in the Inspector.
(function () {
  var el = Lab.el;
  var root, body;
  var BOT_UA = /bot|crawl|spider|headless|lighthouse|phantom|puppeteer|playwright|selenium/i;

  function na(v) { return v === undefined || v === null || v === '' ? 'n/a' : v; }

  function collect() {
    var cb = window.Cookiebot;
    var cookies = {};
    document.cookie.split(';').forEach(function (c) {
      var i = c.indexOf('=');
      if (i > 0) cookies[c.slice(0, i).trim()] = c.slice(i + 1).trim();
    });
    var stored = Lab.decodeConsentCookie(cookies.CookieConsent);
    var ua = navigator.userAgent;
    var botHints = [];
    if (navigator.webdriver) botHints.push('navigator.webdriver is true');
    if (BOT_UA.test(ua)) botHints.push('user agent looks like a bot / automation tool');
    if (/Chrome/.test(ua) && navigator.plugins && navigator.plugins.length === 0) botHints.push('Chrome without plugins (typical of headless)');
    if (!navigator.languages || !navigator.languages.length) botHints.push('no navigator.languages');

    return {
      collectedAt: new Date().toISOString(),
      browser: {
        userAgent: ua,
        languages: (navigator.languages || []).join(', '),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        cookiesEnabled: navigator.cookieEnabled
      },
      automation: {
        webdriver: !!navigator.webdriver,
        looksLikeBot: botHints.length > 0,
        hints: botHints
      },
      privacySignals: {
        globalPrivacyControl: navigator.globalPrivacyControl === undefined ? 'not supported by this browser' : navigator.globalPrivacyControl,
        doNotTrack: na(navigator.doNotTrack),
        cookiebotDoNotTrack: cb ? na(cb.doNotTrack) : 'n/a'
      },
      cookiebot: cb ? {
        hasResponse: !!cb.hasResponse,
        regulations: na(cb.regulations),
        userCountry: na(cb.userCountry),
        consentId: na(cb.consentID || cb.consentId),
        method: na(cb.consent && cb.consent.method),
        consentUTC: na(cb.consentUTC),
        regionInConsentCookie: na(stored && typeof stored === 'object' ? stored.region : null)
      } : 'Cookiebot object not available',
      page: {
        url: location.href,
        domain: location.hostname,
        protocol: location.protocol,
        secureContext: window.isSecureContext,
        referrer: na(document.referrer)
      }
    };
  }

  function group(title, hint, data) {
    return el('div', { class: 'lab-section' }, [
      el('strong', { text: title }),
      el('div', { class: 'lab-hint', text: hint }),
      el('pre', { class: 'lab-pre', text: Lab.pretty(data) })
    ]);
  }

  var state = {};
  function render() {
    state = collect();
    body.textContent = '';
    body.appendChild(el('div', { class: 'lab-hint', text: 'Collected at ' + state.collectedAt + '. Click Refresh after changing the browser / consent.' }));

    var bot = state.automation;
    body.appendChild(el('div', { class: 'lab-check ' + (bot.looksLikeBot ? 'bad' : 'ok'),
      text: (bot.looksLikeBot ? 'CHECK: ' : 'PASS: ') + (bot.looksLikeBot ? 'this browser looks automated: ' + bot.hints.join('; ') + '. Cookiebot may not show the banner to bots.' : 'no automation / bot hints') }));

    body.appendChild(group('Browser', 'What the scenarios call "the environment": browser, language, timezone.', state.browser));
    body.appendChild(group('Automation / bot', 'Signals a CMP can use to treat the visitor as a bot.', state.automation));
    body.appendChild(group('Privacy signals', 'Enable GPC in the browser (Firefox / Brave) to test the GPC scenarios.', state.privacySignals));
    body.appendChild(group('Cookiebot', 'Regulation, country and consent id as the banner reports them. "n/a" = this banner does not expose it.', state.cookiebot));
    body.appendChild(group('Page', 'Consent is stored per domain: check you are on the authorised domain.', state.page));
  }

  Lab.ready(function () {
    root = document.getElementById('test-context');
    if (!root) return;
    body = el('div');
    root.appendChild(body);
    render();
    Lab.registerExport('context', function () { return state; });
    Lab.summaryButton(root, '↻ Refresh', render, 'Re-read browser, privacy signals and Cookiebot properties');
    Lab.onCookiebotEvents(function () { setTimeout(render, 400); });
    window.addEventListener('load', function () { setTimeout(render, 1500); });
  });
})();
