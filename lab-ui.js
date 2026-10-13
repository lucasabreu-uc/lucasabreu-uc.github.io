// Shared helpers for the lab panels (inspector.js, api-panel.js, csp-checker.js).
// Everything is built with createElement + classes only (no innerHTML, no inline
// styles, no inline handlers) so the same code also works on the strict-CSP pages.
window.Lab = (function () {
  // Tiny element factory: Lab.el('div', { class: 'x', text: 'hi' }, [children])
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] === undefined) return;
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'class') node.className = attrs[k];
      else if (k === 'tip') node.setAttribute('data-tip', attrs[k]); // CSS tooltip, see style.css
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  // JSON.stringify that never throws (circular refs, functions, undefined)
  function pretty(value) {
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch (e) { return String(value); }
  }

  // Copy text to the clipboard; falls back to a hidden textarea on http / old browsers
  function copy(text, btn) {
    function done(ok) {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = ok ? 'Copied!' : 'Copy failed';
      setTimeout(function () { btn.textContent = old; }, 1200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      return;
    }
    var ta = el('textarea', { class: 'lab-offscreen' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    done(ok);
  }

  // tip = short tooltip shown on hover/focus (CSS-only, works under strict CSP)
  function button(label, onClick, extraClass, tip) {
    var b = el('button', { type: 'button', class: 'lab-btn ' + (extraClass || ''), text: label, tip: tip });
    b.addEventListener('click', onClick);
    return b;
  }

  // Puts a button at the end of the title row of the <details> that contains `root`,
  // so it is visible while the section is still closed. Clicking it does not toggle the section.
  function summaryButton(root, label, onClick, tip) {
    var summary = root.closest('details') && root.closest('details').querySelector('summary');
    if (!summary) return null;
    var b = button(label, function (e) { e.preventDefault(); e.stopPropagation(); onClick(e); }, '', tip);
    b.className = 'btn-refresh lab-summary-btn';
    summary.appendChild(b);
    return b;
  }

  // Re-render on every Cookiebot event so panels stay in sync with the banner
  var COOKIEBOT_EVENTS = [
    'CookiebotOnDialogDisplay', 'CookiebotOnConsentReady', 'CookiebotOnAccept',
    'CookiebotOnDecline', 'CookiebotOnLoad', 'CookiebotOnDialogInit'
  ];
  function onCookiebotEvents(fn) {
    COOKIEBOT_EVENTS.forEach(function (e) { window.addEventListener(e, fn); });
  }

  return { el: el, pretty: pretty, copy: copy, button: button, summaryButton: summaryButton, onCookiebotEvents: onCookiebotEvents };
})();
