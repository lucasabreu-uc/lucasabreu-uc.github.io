// ITEM 3 - CSP checker (used by csp-strict.html and csp-none.html)
// Mount point: <div id="csp-checker"></div>
// IMPORTANT: load this file in the <head> BEFORE the Cookiebot script (and after the
// CSP <meta>), otherwise violations fired while the banner loads are missed.
//
// What it gives you:
//   1. Live list of CSP violations (securitypolicyviolation event)
//        -> EUD-6150 (no violations under strict nonce-only policy)
//        -> EUD-6244 (no style-src violations without 'unsafe-inline')
//   2. Nonce audit of every <script>/<style>/<link rel=stylesheet> in the DOM
//        -> EUD-6151 (every Cookiebot-created element carries the page nonce)
//        -> EUD-6153 (on a page WITHOUT CSP no nonce may be added)
//   3. Renew button -> EUD-6152 (Cookiebot.renew() re-creates elements with nonce, no violations)
// The mode is detected automatically: a nonce in the page's CSP <meta> = "strict" mode,
// no CSP <meta> = "no CSP" mode.
(function () {
  var violations = [];
  var panelRoot = null;

  // Registered immediately (not on DOMContentLoaded) so nothing is missed.
  document.addEventListener('securitypolicyviolation', function (e) {
    violations.push({
      time: new Date().toLocaleTimeString(),
      directive: e.violatedDirective,
      blocked: e.blockedURI || '(inline)',
      source: e.sourceFile ? e.sourceFile + ':' + e.lineNumber : '(unknown)',
      sample: e.sample || ''
    });
    if (panelRoot) render();
  });

  // Reads the nonce the page declared in its CSP <meta>; null = page has no CSP
  function expectedNonce() {
    var m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!m) return null;
    var found = /'nonce-([^']+)'/.exec(m.getAttribute('content') || '');
    return found ? found[1] : null;
  }

  // Where did the element come from? Same-origin files are ours and need no nonce check.
  function originOf(node) {
    if (node.tagName === 'SCRIPT' && node.src) {
      var host = new URL(node.src).hostname;
      if (host === location.hostname) return 'own file';
      return /cookiebot|usercentrics/i.test(host) ? 'cookiebot host' : 'third party';
    }
    if (node.tagName === 'LINK' && node.href) {
      return new URL(node.href).hostname === location.hostname ? 'own file' : 'external stylesheet';
    }
    return 'inline / created at runtime';
  }

  function auditNonces() {
    var expected = expectedNonce();
    var rows = [];
    Array.prototype.forEach.call(document.querySelectorAll('script, style, link[rel="stylesheet"]'), function (node) {
      // node.nonce is the reliable property (browsers hide the attribute after parsing)
      var nonce = node.nonce || node.getAttribute('nonce') || '';
      var origin = originOf(node);
      var checked = origin !== 'own file';
      var ok = true;
      if (checked) ok = expected ? nonce === expected : nonce === '';
      rows.push({
        tag: node.tagName.toLowerCase(),
        id: node.id || '',
        origin: origin,
        what: node.src || node.href || (node.textContent || '').slice(0, 60).replace(/\s+/g, ' '),
        nonce: nonce || '(none)',
        checked: checked,
        ok: ok
      });
    });
    return { expected: expected, rows: rows };
  }

  function render() {
    var el = Lab.el;
    var audit = auditNonces();
    var mode = audit.expected ? 'STRICT (nonce-only CSP)' : 'NO CSP';
    var styleViolations = violations.filter(function (v) { return /^style-src/.test(v.directive); }).length;
    var badRows = audit.rows.filter(function (r) { return r.checked && !r.ok; });
    var checkedRows = audit.rows.filter(function (r) { return r.checked; });

    panelRoot.textContent = '';

    // ---- summary ----
    var strict = !!audit.expected;
    panelRoot.appendChild(el('div', { class: 'lab-section' }, [
      el('strong', { text: 'Mode: ' + mode }),
      el('div', { class: 'lab-hint', text: strict
        ? 'Expected nonce: ' + audit.expected + '. Banner must produce 0 violations and every Cookiebot element must carry this nonce.'
        : 'No CSP meta on this page. Control case: banner must work and must NOT add any nonce.' }),
      el('div', { class: 'lab-check ' + (violations.length === 0 ? 'ok' : 'bad'),
        text: (violations.length === 0 ? 'PASS' : 'FAIL') + ': ' + violations.length + ' violation(s), ' + styleViolations + ' of them style-src' }),
      el('div', { class: 'lab-check ' + (badRows.length === 0 ? 'ok' : 'bad'),
        text: (badRows.length === 0 ? 'PASS' : 'FAIL') + ': ' + (checkedRows.length - badRows.length) + '/' + checkedRows.length +
          ' non-own elements ' + (strict ? 'carry the page nonce' : 'have no nonce') })
    ]));

    // ---- actions ----
    panelRoot.appendChild(el('div', { class: 'lab-toolbar' }, [
      Lab.button('Re-run audit', render),
      Lab.button('Cookiebot.renew() then re-audit', function () {
        // EUD-6152: renew re-creates the banner; wait a moment so new elements exist before auditing
        if (window.Cookiebot && typeof window.Cookiebot.renew === 'function') window.Cookiebot.renew();
        setTimeout(render, 1500);
      }),
      Lab.button('Clear consent & reload', function () {
        // Same idea as clearConsent() in status.js (not loaded here: it injects an un-nonced cd.js script)
        ['CookieConsent', 'CookieConsentBulkTicket'].forEach(function (name) {
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + location.hostname;
        });
        location.reload();
      }),
      Lab.button('Clear violations', function () { violations = []; render(); }, 'lab-btn-small'),
      Lab.button('Copy report as JSON', function (e) {
        Lab.copy(Lab.pretty({ mode: mode, url: location.href, violations: violations, nonceAudit: audit }), e.target);
      }, 'lab-btn-small')
    ]));

    // ---- violations table ----
    panelRoot.appendChild(el('strong', { text: 'CSP violations' }));
    if (violations.length === 0) {
      panelRoot.appendChild(el('div', { class: 'lab-hint', text: 'None so far. Interact with the banner (open 2nd layer, accept, renew) and watch this list.' }));
    } else {
      panelRoot.appendChild(table(['Time', 'Directive', 'Blocked', 'Source', 'Sample'],
        violations.map(function (v) { return [v.time, v.directive, v.blocked, v.source, v.sample]; })));
    }

    // ---- nonce table ----
    panelRoot.appendChild(el('strong', { text: 'Nonce audit (every script / style / stylesheet in the DOM)' }));
    panelRoot.appendChild(el('div', { class: 'lab-hint', text: '"own file" rows are this lab\'s own assets and are not checked. Everything else is judged against the expected nonce.' }));
    panelRoot.appendChild(table(['Tag', 'Id', 'Origin', 'What', 'Nonce', 'Result'],
      audit.rows.map(function (r) { return [r.tag, r.id, r.origin, r.what, r.nonce, !r.checked ? 'n/a' : (r.ok ? 'PASS' : 'FAIL')]; }),
      5));
  }

  // Builds a table; resultCol (optional) = column index colored PASS/FAIL
  function table(headers, rows, resultCol) {
    var el = Lab.el;
    var thead = el('tr', {}, headers.map(function (h) { return el('th', { text: h }); }));
    var body = rows.map(function (r) {
      return el('tr', {}, r.map(function (cell, i) {
        var cls = i === resultCol ? (cell === 'PASS' ? 'ok' : cell === 'FAIL' ? 'bad' : '') : '';
        return el('td', { class: cls, text: String(cell) });
      }));
    });
    return el('div', { class: 'lab-table-wrap' }, [el('table', { class: 'lab-table' }, [el('thead', {}, [thead]), el('tbody', {}, body)])]);
  }

  document.addEventListener('DOMContentLoaded', function () {
    panelRoot = document.getElementById('csp-checker');
    if (!panelRoot) return;
    render();
    Lab.onCookiebotEvents(function () { setTimeout(render, 300); });
    // The banner can render after the events above; a late audit catches it
    window.addEventListener('load', function () { setTimeout(render, 1500); });
  });
})();
