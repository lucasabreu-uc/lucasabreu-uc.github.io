// DSR link & placeholder tokens panel
// Mount point: <div id="dsr-panel"></div>
// Read-only look at the banner DOM for the "Data subject request" (DSR) link:
//   - settings the script received    -> CookieConsentDialog.dsrFormEnabled / dsrFormUrl / dsrFormUrlText
//   - DSR containers + anchor in DOM  -> .CybotCookiebotDialogDsrFormUrlDiv, #CybotCookiebotDialogDsrFormUrl
//   - leftover [#TOKEN#] placeholders -> any token the banner did not replace (a crawler reads them as URLs)
// HOW TO USE: open the page with the banner loaded, expand the panel. DSR disabled -> expect 0 containers,
// 0 anchors and no DSR token. DSR enabled -> expect the anchor with the configured href. "Copy all as JSON"
// gives a block to paste as evidence in Xray.
(function () {
  var el = Lab.el;
  var root;
  var state = {};

  // Built with concatenation so this file never writes a literal token that a scanner could mistake for a leftover
  var OPEN = '[' + '#';
  var CLOSE = '#' + ']';
  var TOKEN_RE = new RegExp('\\[' + '#([A-Za-z0-9_]+)#' + '\\]', 'g');
  var DSR_TOKENS = ['DSR_FORM_URL', 'DSR_FORM_URL_TEXT'];

  function isVisible(node) {
    if (!node) return false;
    var cs = getComputedStyle(node);
    var r = node.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }

  function scanTokens(dialog) {
    var counts = {};
    var html = dialog ? dialog.outerHTML : '';
    var m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(html)) !== null) {
      var name = OPEN + m[1] + CLOSE;
      counts[name] = (counts[name] || 0) + 1;
    }
    return counts;
  }

  function collect() {
    var cd = window.CookieConsentDialog || {};
    var dialog = document.getElementById('CybotCookiebotDialog');
    var containers = dialog ? Array.prototype.slice.call(dialog.querySelectorAll('.CybotCookiebotDialogDsrFormUrlDiv')) : [];
    var anchors = dialog ? Array.prototype.slice.call(dialog.querySelectorAll('#CybotCookiebotDialogDsrFormUrl')) : [];
    var tokens = scanTokens(dialog);
    var dsrTokenCount = 0;
    var otherTokenCount = 0;
    Object.keys(tokens).forEach(function (t) {
      if (DSR_TOKENS.some(function (n) { return t === OPEN + n + CLOSE; })) dsrTokenCount += tokens[t];
      else otherTokenCount += tokens[t];
    });

    return {
      collectedAt: new Date().toISOString(),
      url: location.href,
      bannerInDom: !!dialog,
      template: cd.template === undefined ? null : cd.template,
      dsrFormEnabled: cd.dsrFormEnabled === undefined ? null : cd.dsrFormEnabled,
      dsrFormUrl: cd.dsrFormUrl === undefined ? null : cd.dsrFormUrl,
      dsrFormUrlText: cd.dsrFormUrlText === undefined ? null : cd.dsrFormUrlText,
      containers: containers.map(function (c) {
        return { id: c.id || null, visible: isVisible(c), hasAnchor: !!c.querySelector('a') };
      }),
      anchors: anchors.map(function (a) {
        return { href: a.getAttribute('href'), text: a.textContent.trim(), target: a.getAttribute('target'), rel: a.getAttribute('rel'), visible: isVisible(a) };
      }),
      tokensLeftInBanner: tokens,
      dsrTokenCount: dsrTokenCount,
      otherTokenCount: otherTokenCount
    };
  }

  // ---- checks: quick PASS / CHECK hints so you do not eyeball the DOM ----
  function checkDsr(s) {
    if (!s.bannerInDom) return { ok: false, msg: 'banner is not in the DOM (consent already stored? use "Clear consent & reload")' };
    if (s.dsrFormEnabled === null) return { ok: false, msg: 'CookieConsentDialog.dsrFormEnabled is not defined: the banner script has not finished loading' };
    if (s.dsrTokenCount > 0) return { ok: false, msg: s.dsrTokenCount + ' unreplaced DSR token(s) in the banner (a crawler would request them as relative URLs)' };
    if (!s.dsrFormEnabled) {
      if (s.containers.length || s.anchors.length) {
        return { ok: false, msg: 'DSR is disabled but ' + s.containers.length + ' container(s) and ' + s.anchors.length + ' anchor(s) are still in the DOM' };
      }
      return { ok: true, msg: 'DSR disabled: no container, no anchor and no DSR token in the banner' };
    }
    if (!s.anchors.length) return { ok: false, msg: 'DSR is enabled but the anchor is missing from the banner' };
    var wrong = s.anchors.filter(function (a) { return a.href !== s.dsrFormUrl; });
    if (wrong.length) return { ok: false, msg: 'DSR is enabled but ' + wrong.length + ' anchor(s) have an href different from dsrFormUrl' };
    return { ok: true, msg: 'DSR enabled: ' + s.anchors.length + ' anchor(s) with href ' + s.dsrFormUrl + ' and no DSR token' };
  }

  function checkOtherTokens(s) {
    if (!s.bannerInDom) return null;
    if (s.otherTokenCount === 0) return { ok: true, msg: 'no other unreplaced placeholder in the banner' };
    return { ok: false, msg: s.otherTokenCount + ' other unreplaced placeholder(s) in the banner (outside the DSR fix; may also confuse crawlers)' };
  }

  // ---- rendering ----
  function section(title, hint, value, check) {
    var head = el('div', { class: 'lab-section-head' }, [
      el('strong', { text: title }),
      Lab.button('Copy', function (e) { Lab.copy(Lab.pretty(value), e.target); }, 'lab-btn-small', 'Copy this block to the clipboard')
    ]);
    var kids = [head, el('div', { class: 'lab-hint', text: hint })];
    if (check) kids.push(el('div', { class: 'lab-check ' + (check.ok ? 'ok' : 'bad'), text: (check.ok ? 'PASS: ' : 'CHECK: ') + check.msg }));
    kids.push(el('pre', { class: 'lab-pre', text: Lab.pretty(value) }));
    return el('div', { class: 'lab-section' }, kids);
  }

  function render() {
    root.textContent = '';

    var bar = el('div', { class: 'lab-toolbar' });
    bar.appendChild(Lab.button('Copy all as JSON', function (e) { Lab.copy(Lab.pretty(state), e.target); }, '', 'Copy the full snapshot, paste it as Xray evidence'));
    root.appendChild(bar);
    root.appendChild(el('div', { class: 'lab-hint', text: 'Collected at ' + state.collectedAt + '. Read-only: it never changes the banner.' }));

    root.appendChild(section('Settings the banner script received',
      'dsrFormEnabled is true only when the DSR link is on AND a URL is set. Template shows which banner layout is rendered ("custom" = custom code banner).',
      { template: state.template, dsrFormEnabled: state.dsrFormEnabled, dsrFormUrl: state.dsrFormUrl, dsrFormUrlText: state.dsrFormUrlText }));
    root.appendChild(section('DSR containers and anchors in the banner DOM',
      'Class CybotCookiebotDialogDsrFormUrlDiv (compact banners have two) and id CybotCookiebotDialogDsrFormUrl. Disabled DSR should leave none of them.',
      { containers: state.containers, anchors: state.anchors }, checkDsr(state)));
    root.appendChild(section('Unreplaced placeholders in the banner',
      'Every ' + OPEN + 'NAME' + CLOSE + ' still present in the banner HTML. Only the DSR ones belong to the DSR fix.',
      state.tokensLeftInBanner, checkOtherTokens(state)));
  }

  var refreshId = 0;
  function refresh() {
    var id = ++refreshId;
    var snap = collect();
    if (id !== refreshId) return;
    state = snap;
    render();
  }

  Lab.ready(function () {
    root = document.getElementById('dsr-panel');
    if (!root) return;
    Lab.registerExport('dsr', function () { return state; });
    Lab.summaryButton(root, '↻ Refresh', refresh, 'Re-read the banner DOM now');
    refresh();
    // The banner is injected after load and re-rendered when it opens into the dialog: re-read a few times
    Lab.onCookiebotEvents(function () {
      refresh();
      setTimeout(refresh, 700);
      setTimeout(refresh, 2000);
    });
    setTimeout(refresh, 1500);
    setTimeout(refresh, 4000);
    window.addEventListener('focus', refresh);
  });
})();
