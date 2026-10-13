// ITEM 2 - API Panel
// Mount point: <div id="api-panel"></div>
// One button per public API call used by the manual scenarios, so you stop typing
// in the DevTools console. Every call is logged (newest first) with its result or error.
//   - Cookiebot.* methods                           -> EUD-6152 (renew) and general sanity
//   - language switch                               -> language scenarios
(function () {
  var el = Lab.el;
  var logBox;
  var calls = []; // for the full report

  function log(label, outcome, ok) {
    calls.unshift({ time: new Date().toISOString(), call: label, ok: ok, result: outcome });
    var entry = el('div', { class: 'lab-log-entry ' + (ok ? 'ok' : 'bad') }, [
      el('div', { class: 'lab-log-head', text: new Date().toLocaleTimeString() + '  ' + label + '  ->  ' + (ok ? 'OK' : 'ERROR') }),
      el('pre', { class: 'lab-pre', text: Lab.pretty(outcome) })
    ]);
    logBox.insertBefore(entry, logBox.firstChild);
  }

  // Runs fn, logs the return value (awaits promises) or the thrown error.
  function run(label, fn) {
    try {
      var result = fn();
      if (result && typeof result.then === 'function') {
        result.then(function (v) { log(label, v, true); }, function (e) { log(label, String(e), false); });
      } else {
        log(label, result === undefined ? '(no return value)' : result, true);
      }
    } catch (e) {
      log(label, e.message, false);
    }
  }

  function need(path) {
    var parts = path.split('.');
    var obj = window[parts[0]];
    if (!obj) throw new Error(parts[0] + ' is not defined on this page/banner');
    if (parts[1] && typeof obj[parts[1]] !== 'function') throw new Error(path + ' is not a function on this banner');
    return obj;
  }

  // A group = title + hint + a row of controls
  function group(title, hint, controls) {
    return el('div', { class: 'lab-section' }, [
      el('strong', { text: title }),
      el('div', { class: 'lab-hint', text: hint }),
      el('div', { class: 'lab-row' }, controls)
    ]);
  }

  var TIPS = {
    'Cookiebot.show': 'Open the banner (2nd layer if consent exists)',
    'Cookiebot.hide': 'Close the banner without answering',
    'Cookiebot.renew': 'Re-create the banner (shows it again, re-creates elements)',
    'Cookiebot.withdraw': 'Withdraw consent and reopen the banner',
    'Cookiebot.runScripts': 'Re-run scripts blocked by data-cookieconsent'
  };

  function callBtn(label, path, args) {
    return Lab.button(label, function () {
      run(path + '(' + (args || []).map(function (a) { return JSON.stringify(a); }).join(', ') + ')', function () {
        var parts = path.split('.');
        return need(path)[parts[1]].apply(window[parts[0]], args || []);
      });
    }, '', TIPS[path]);
  }

  var LANGS = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'sv', 'da', 'fi', 'pl', 'ja'];

  function build(root) {
    root.textContent = '';
    if (!logBox) logBox = el('div', { class: 'lab-log' }); // kept across refreshes so the call log survives

    var langSel = el('select', { id: 'api-lang', class: 'lab-input', tip: 'Language code to switch the banner to', 'aria-label': 'Language' },
      LANGS.map(function (l) { return el('option', { value: l, text: l }); }));

    root.appendChild(el('div', { class: 'lab-hint', text: 'Checked at ' + new Date().toLocaleTimeString() + ': Cookiebot ' +
      (window.Cookiebot ? 'available' : 'NOT available') + '.' }));

    root.appendChild(group('Cookiebot object',
      'Basic banner control. renew() re-creates the banner elements (EUD-6152: check nonce + CSP violations on the CSP page).',
      [
        callBtn('show()', 'Cookiebot.show'),
        callBtn('hide()', 'Cookiebot.hide'),
        callBtn('renew()', 'Cookiebot.renew'),
        callBtn('withdraw()', 'Cookiebot.withdraw'),
        callBtn('runScripts()', 'Cookiebot.runScripts')
      ]));

    root.appendChild(group('Language',
      'Switch the banner language, then open the banner/second layer and verify all texts changed. Uses Cookiebot.changeLanguage.',
      [
        langSel,
        Lab.button('Change language', function () {
          var lang = langSel.value;
          run('Cookiebot.changeLanguage("' + lang + '")', function () { return need('Cookiebot.changeLanguage').changeLanguage(lang); });
        }, '', 'Apply the selected language, then open the banner to verify texts')
      ]));

    root.appendChild(el('div', { class: 'lab-toolbar' }, [
      el('strong', { text: 'Call log' }),
      Lab.button('Clear log', function () { logBox.textContent = ''; }, 'lab-btn-small', 'Remove all log entries')
    ]));
    root.appendChild(logBox);
  }

  Lab.ready(function () {
    var root = document.getElementById('api-panel');
    if (!root) return;
    build(root);
    Lab.registerExport('apiCalls', function () { return calls; });
    Lab.summaryButton(root, '\u21BB Refresh', function () { build(root); }, 'Re-check Cookiebot availability (call log is kept)');
  });
})();
