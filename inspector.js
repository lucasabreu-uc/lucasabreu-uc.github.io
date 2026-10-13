// ITEM 1 - Storage & Strings Inspector
// Mount point: <div id="inspector"></div>
// Shows what the banner actually WROTE (not just what window.Cookiebot reports):
//   - consent cookies (decoded)           -> sanity check after any accept/decline
//   - localStorage values                 -> EUD-6156
//   - GACM / Additional Consent string    -> EUD-6157 (comes from TCF getTCData().addtlConsent)
//   - TC string                           -> EUD-6158
//   - US Privacy / GPP strings, GPC flag  -> US + GPC scenarios (EUD-4730..4737)
// HOW TO USE: accept/decline in the banner, then check the cards; the panel
// refreshes itself on every Cookiebot event. "Copy all as JSON" gives you a
// block to paste as evidence in Xray.
(function () {
  var el = Lab.el;
  var TCF_TIMEOUT_MS = 3000;

  // Which localStorage keys count as "banner related". Edit this list if the
  // banner stores values under a new prefix. The checkbox shows ALL keys.
  var STORAGE_PATTERN = /^(uc_|ucData|ucString|usercentrics|cookiebot|cb_|CookieConsent|gacm|addtl|IABTCF|IABUSPrivacy|IABGPP)/i;

  var state = {};      // last collected snapshot (also what "Copy all as JSON" exports)
  var showAllStorage = false;
  var root;

  function readCookies() {
    var out = {};
    document.cookie.split(';').forEach(function (c) {
      var i = c.indexOf('=');
      if (i < 0) return;
      out[c.slice(0, i).trim()] = c.slice(i + 1).trim();
    });
    return out;
  }

  // CookieConsent is a URL-encoded JS object literal: {stamp:'x',necessary:true,...}
  // Convert it to JSON so it is readable; fall back to the raw string if that fails.
  function decodeConsentCookie(raw) {
    if (!raw) return null;
    var decoded;
    try { decoded = decodeURIComponent(raw); } catch (e) { return raw; }
    try {
      return JSON.parse(decoded.replace(/([{,])\s*([A-Za-z_]+)\s*:/g, '$1"$2":').replace(/'/g, '"'));
    } catch (e) { return decoded; }
  }

  function readStorage() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (showAllStorage || STORAGE_PATTERN.test(k)) out[k] = localStorage.getItem(k);
      }
    } catch (e) { out.__error = 'localStorage not accessible: ' + e.message; }
    return out;
  }

  // Generic "call a CMP API and give up after a timeout" wrapper.
  // Resolves with { available: false } when the API does not exist / never answers
  // (e.g. TCF not enabled for this banner) so the card says so instead of hanging.
  function callApi(name, invoke) {
    return new Promise(function (resolve) {
      if (typeof window[name] !== 'function') return resolve({ available: false, reason: name + ' is not defined' });
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) { settled = true; resolve({ available: false, reason: name + ' did not answer in ' + TCF_TIMEOUT_MS + 'ms' }); }
      }, TCF_TIMEOUT_MS);
      try {
        invoke(function (data, success) {
          if (settled) return;
          settled = true; clearTimeout(timer);
          resolve({ available: true, success: success, data: data });
        });
      } catch (e) {
        settled = true; clearTimeout(timer);
        resolve({ available: false, reason: name + ' threw: ' + e.message });
      }
    });
  }

  function collect() {
    var cookies = readCookies();
    var snapshot = {
      collectedAt: new Date().toISOString(),
      url: location.href,
      userAgent: navigator.userAgent,
      gpc: navigator.globalPrivacyControl === undefined ? 'not supported by this browser' : navigator.globalPrivacyControl,
      consentCookie: decodeConsentCookie(cookies.CookieConsent),
      bulkTicketCookie: cookies.CookieConsentBulkTicket || null,
      localStorage: readStorage()
    };

    return Promise.all([
      callApi('__tcfapi', function (cb) { window.__tcfapi('getTCData', 2, cb); }),
      callApi('__uspapi', function (cb) { window.__uspapi('getUSPData', 1, cb); }),
      callApi('__gpp',    function (cb) { window.__gpp('getGPPData', cb); })
    ]).then(function (r) {
      snapshot.tcf = r[0];
      snapshot.usp = r[1];
      snapshot.gpp = r[2];
      // GACM (Google Additional Consent Mode) string lives inside the TCF payload
      snapshot.gacm = r[0].available && r[0].data ? (r[0].data.addtlConsent || null) : null;
      snapshot.tcString = r[0].available && r[0].data ? (r[0].data.tcString || null) : null;
      return snapshot;
    });
  }

  // ---- format checks: quick pass/fail hints so you do not eyeball strings ----
  // TC string: base64url segments separated by "." - first char "C" for TCF v2 core.
  function checkTcString(s) {
    if (!s) return { ok: false, msg: 'empty (no consent given yet, or TCF disabled)' };
    var ok = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(s) && s.charAt(0) === 'C';
    return { ok: ok, msg: ok ? 'looks like a valid TCF v2 string (' + s.length + ' chars)' : 'does NOT look like a TCF v2 string' };
  }
  // GACM: "<spec version>~<id>.<id>..." e.g. 1~89.1000.2307
  function checkGacm(s) {
    if (!s) return { ok: false, msg: 'empty (no Google ATP vendors consented, or TCF disabled)' };
    var ok = /^\d+~(\d+(\.\d+)*)?(~dv\.(\d+(\.\d+)*)?)?$/.test(s);
    return { ok: ok, msg: ok ? 'matches <version>~<ids> format' : 'does NOT match <version>~<ids> format' };
  }

  // ---- rendering ----
  function section(title, hint, value, check) {
    var pre = el('pre', { class: 'lab-pre', text: Lab.pretty(value) });
    var head = el('div', { class: 'lab-section-head' }, [
      el('strong', { text: title }),
      Lab.button('Copy', function (e) { Lab.copy(Lab.pretty(value), e.target); }, 'lab-btn-small', 'Copy this block to the clipboard')
    ]);
    var kids = [head, el('div', { class: 'lab-hint', text: hint })];
    if (check) kids.push(el('div', { class: 'lab-check ' + (check.ok ? 'ok' : 'bad'), text: (check.ok ? 'PASS: ' : 'CHECK: ') + check.msg }));
    kids.push(pre);
    return el('div', { class: 'lab-section' }, kids);
  }

  function render() {
    root.textContent = '';

    var bar = el('div', { class: 'lab-toolbar' });
    bar.appendChild(Lab.button('Refresh', refresh, '', 'Re-read cookies, storage and CMP APIs now'));
    bar.appendChild(Lab.button('Copy all as JSON', function (e) { Lab.copy(Lab.pretty(state), e.target); }, '', 'Copy the full snapshot, paste it as Xray evidence'));

    var chk = el('input', { type: 'checkbox', id: 'inspector-all-storage' });
    chk.checked = showAllStorage;
    chk.addEventListener('change', function () { showAllStorage = chk.checked; refresh(); });
    bar.appendChild(el('label', { class: 'lab-inline', for: 'inspector-all-storage', tip: 'Off = only banner-related keys. On = every key on this site' }, [chk, el('span', { text: ' Show ALL localStorage keys' })]));
    root.appendChild(bar);

    root.appendChild(el('div', { class: 'lab-hint', text: 'Collected at ' + state.collectedAt + '. Auto-refreshes on every Cookiebot event.' }));

    root.appendChild(section('Consent cookie (CookieConsent)', 'Decoded. Check stamp, the 4 categories, method ("explicit" / "implied") and region.', state.consentCookie));
    root.appendChild(section('Bulk consent ticket', 'Set only when bulk consent is on. Compare this value across domains (item 5).', state.bulkTicketCookie));
    root.appendChild(section('localStorage', 'EUD-6156: values must be set after consent submission. Empty before the user answers.', state.localStorage));
    root.appendChild(section('TC string (__tcfapi)', 'EUD-6158: format after consent. Needs a TCF-enabled banner; otherwise "not available" is expected.', state.tcString, checkTcString(state.tcString)));
    root.appendChild(section('GACM / Additional Consent', 'EUD-6157: Google additional consent string, read from getTCData().addtlConsent.', state.gacm, checkGacm(state.gacm)));
    root.appendChild(section('Full TCF response', 'Raw getTCData answer: cmpId, gdprApplies, purposes, vendors, etc.', state.tcf));
    root.appendChild(section('US Privacy (__uspapi)', 'CCPA string, e.g. "1YNN". Needs a US/CCPA banner.', state.usp));
    root.appendChild(section('GPP (__gpp)', 'Global Privacy Platform data. Needs GPP enabled in the banner.', state.gpp));
    root.appendChild(section('Global Privacy Control', 'navigator.globalPrivacyControl. Enable GPC in the browser (Firefox/Brave) to test the GPC scenarios.', state.gpc));
  }

  // Only the latest refresh may render: events + focus can fire overlapping async collects
  var refreshId = 0;
  function refresh() {
    var id = ++refreshId;
    collect().then(function (snap) {
      if (id !== refreshId) return;
      state = snap;
      render();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    root = document.getElementById('inspector');
    if (!root) return;
    refresh();
    Lab.onCookiebotEvents(refresh);
    // Cookies/localStorage can change without an event (e.g. "Clear consent"): cheap safety net
    window.addEventListener('focus', refresh);
  });
})();
