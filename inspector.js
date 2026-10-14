// ITEM 1 - Storage & Strings Inspector (cookies + TCF strings)
// Mount point: <div id="inspector"></div>
// Shows what the banner actually WROTE (not just what window.Cookiebot reports):
//   - consent cookies (decoded)           -> sanity check after any accept/decline
//   - TC string / TCF response            -> only when TCF is enabled in the banner
//   - GPC flag                            -> browser opt-out signal Cookiebot can honor
// HOW TO USE: accept/decline in the banner, then check the cards; the panel
// refreshes itself on every Cookiebot event. "Copy all as JSON" gives you a
// block to paste as evidence in Xray.
(function () {
  var el = Lab.el;
  var TCF_TIMEOUT_MS = 3000;

  var state = {};      // last collected snapshot (also what "Copy all as JSON" exports)
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
      consentCookie: Lab.decodeConsentCookie(cookies.CookieConsent),
      bulkTicketCookie: cookies.CookieConsentBulkTicket || null
    };

    return callApi('__tcfapi', function (cb) { window.__tcfapi('getTCData', 2, cb); }).then(function (r) {
      snapshot.tcf = r;
      snapshot.tcString = r.available && r.data ? (r.data.tcString || null) : null;
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
    bar.appendChild(Lab.button('Copy all as JSON', function (e) { Lab.copy(Lab.pretty(state), e.target); }, '', 'Copy the full snapshot, paste it as Xray evidence'));

    root.appendChild(bar);

    root.appendChild(el('div', { class: 'lab-hint', text: 'Collected at ' + state.collectedAt + '. Auto-refreshes on every Cookiebot event.' }));

    root.appendChild(section('Consent cookie (CookieConsent)', 'Decoded. Check stamp, the 4 categories, method ("explicit" / "implied") and region.', state.consentCookie));
    root.appendChild(section('Bulk consent ticket', 'Set only when bulk consent is on. Compare this value across domains (item 5).', state.bulkTicketCookie));
    root.appendChild(section('TC string (__tcfapi)', 'Format after consent. Needs a TCF-enabled banner; otherwise "not available" is expected.', state.tcString, checkTcString(state.tcString)));
    root.appendChild(section('Full TCF response', 'Raw getTCData answer: cmpId, gdprApplies, purposes, vendors, etc.', state.tcf));
    root.appendChild(section('Global Privacy Control', 'navigator.globalPrivacyControl. Enable GPC in the browser (Firefox/Brave) to test how the banner reacts.', state.gpc));
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

  Lab.ready(function () {
    root = document.getElementById('inspector');
    if (!root) return;
    Lab.registerExport('inspector', function () { return state; });
    Lab.summaryButton(root, '\u21BB Refresh', refresh, 'Re-read cookies and the TCF API now');
    refresh();
    // The banner writes cookies slightly AFTER the event fires, so re-read a couple of times
    Lab.onCookiebotEvents(function () {
      refresh();
      setTimeout(refresh, 700);
      setTimeout(refresh, 2000);
    });
    // Cookies can change without an event (e.g. "Clear consent"): cheap safety net
    window.addEventListener('focus', refresh);
  });
})();
