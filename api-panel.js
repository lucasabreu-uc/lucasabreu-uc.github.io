// ITEM 2 - API Panel
// Mount point: <div id="api-panel"></div>
// One button per public API call used by the manual scenarios, so you stop typing
// in the DevTools console. Every call is logged (newest first) with its result or error.
//   - Cookiebot.* methods                           -> EUD-6152 (renew) and general sanity
//   - UC_UI.showSecondLayer(...)                    -> EUD-4697..4700
//   - UC_UI.getServicesBaseInfo() + array methods   -> EUD-4874..4879
//   - language switch                               -> language scenarios
// NOTE: UC_UI only exists on banners that expose it. If a button logs
// "UC_UI is not defined", that banner does not support the API (that is a finding, not a bug in this page).
(function () {
  var el = Lab.el;
  var logBox;

  function log(label, outcome, ok) {
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

  function callBtn(label, path, args) {
    return Lab.button(label, function () {
      run(path + '(' + (args || []).map(function (a) { return JSON.stringify(a); }).join(', ') + ')', function () {
        var parts = path.split('.');
        return need(path)[parts[1]].apply(window[parts[0]], args || []);
      });
    });
  }

  function textInput(id, placeholder) {
    return el('input', { type: 'text', id: id, class: 'lab-input', placeholder: placeholder });
  }

  // EUD-4874..4879: the result of getServicesBaseInfo() must support .map/.filter/.find
  // and null/undefined must be handled without throwing.
  function arrayMethodsCheck() {
    var info = need('UC_UI').getServicesBaseInfo();
    var report = { type: Array.isArray(info) ? 'array (' + info.length + ' items)' : String(info) };
    if (!Array.isArray(info)) {
      report.note = 'Not an array: scenario "Handling null or undefined data" - make sure nothing threw above.';
      return report;
    }
    report.map = info.map(function (s) { return s.id || s.name; }).slice(0, 5);
    report.filter = info.filter(function (s) { return !!s; }).length;
    report.find = info.find(function (s) { return !!s; }) ? 'found first truthy item' : 'no item';
    return report;
  }

  var LANGS = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'sv', 'da', 'fi', 'pl', 'ja'];

  function build(root) {
    logBox = el('div', { class: 'lab-log' });

    var secondLayerTarget = textInput('api-second-layer', 'tab name or service/vendor id');
    var langSel = el('select', { id: 'api-lang', class: 'lab-input' },
      LANGS.map(function (l) { return el('option', { value: l, text: l }); }));

    root.appendChild(group('Cookiebot object',
      'Basic banner control. renew() re-creates the banner elements (EUD-6152: check nonce + CSP violations on the CSP page).',
      [
        callBtn('show()', 'Cookiebot.show'),
        callBtn('hide()', 'Cookiebot.hide'),
        callBtn('renew()', 'Cookiebot.renew'),
        callBtn('withdraw()', 'Cookiebot.withdraw'),
        callBtn('runScripts()', 'Cookiebot.runScripts')
      ]));

    root.appendChild(group('UC_UI consent actions',
      'Programmatic consent. After clicking, check the Consent Status card and the Inspector (item 1).',
      [
        callBtn('acceptAllConsents()', 'UC_UI.acceptAllConsents'),
        callBtn('denyAllConsents()', 'UC_UI.denyAllConsents'),
        callBtn('isInitialized()', 'UC_UI.isInitialized'),
        callBtn('closeCMP()', 'UC_UI.closeCMP')
      ]));

    root.appendChild(group('UC_UI.showSecondLayer',
      'EUD-4697..4700. Leave empty = plain call; or type a tab (purposes / vendors / categories / services) or a service/TCF vendor id. Click twice to test "already open" (EUD-4700).',
      [
        secondLayerTarget,
        Lab.button('showSecondLayer(target)', function () {
          var v = secondLayerTarget.value.trim();
          var asNumber = /^\d+$/.test(v) ? Number(v) : v; // TCF vendor ids are numeric
          var args = v ? [asNumber] : [];
          run('UC_UI.showSecondLayer(' + args.map(function (a) { return JSON.stringify(a); }).join(', ') + ')',
            function () { return need('UC_UI.showSecondLayer').showSecondLayer.apply(window.UC_UI, args); });
        })
      ]));

    root.appendChild(group('Services info + array methods',
      'EUD-4874..4879: base/full info must be usable with .map/.filter/.find, and null/undefined must not throw.',
      [
        callBtn('getServicesBaseInfo()', 'UC_UI.getServicesBaseInfo'),
        callBtn('getServicesFullInfo()', 'UC_UI.getServicesFullInfo'),
        Lab.button('Run map / filter / find check', function () { run('array methods on getServicesBaseInfo()', arrayMethodsCheck); })
      ]));

    root.appendChild(group('Language',
      'Switch the banner language, then open the banner/second layer and verify all texts changed. Tries Cookiebot.changeLanguage, falls back to UC_UI.updateLanguage.',
      [
        langSel,
        Lab.button('Change language', function () {
          var lang = langSel.value;
          run('changeLanguage("' + lang + '")', function () {
            if (window.Cookiebot && typeof window.Cookiebot.changeLanguage === 'function') return window.Cookiebot.changeLanguage(lang);
            return need('UC_UI.updateLanguage').updateLanguage(lang);
          });
        })
      ]));

    root.appendChild(el('div', { class: 'lab-toolbar' }, [
      el('strong', { text: 'Call log' }),
      Lab.button('Clear log', function () { logBox.textContent = ''; }, 'lab-btn-small')
    ]));
    root.appendChild(logBox);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('api-panel');
    if (root) build(root);
  });
})();
