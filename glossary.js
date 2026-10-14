// Glossary + automatic term tooltips
// 1. GLOSSARY: every term the lab uses, with a short explanation.
// 2. explain(): wraps known terms found in the page text in <abbr class="lab-term"> (dotted
//    underline, hover / focus / tap shows the explanation). First occurrence per block only.
//    Skips <pre> (JSON), buttons, links, inputs, summaries and anything that already has a tooltip.
// 3. A MutationObserver re-runs explain() whenever a panel re-renders.
// 4. <div id="glossary"> gets the full list with a filter box.
// 5. Tooltips flip to the left when they would run off the right edge of the screen.
// Built with Lab.el only (no innerHTML / inline styles): works on the strict-CSP pages too.
(function () {
  var el = Lab.el;

  // term = what the glossary list shows; match = exact strings (case-sensitive) found in the page
  var GLOSSARY = [
    // ---- consent & privacy ----
    { term: 'CMP', match: ['CMP'], text: 'Consent Management Platform: the software (here Cookiebot) that shows the banner and stores the visitor\'s choice.' },
    { term: 'TCF', match: ['TCF'], text: 'Transparency & Consent Framework (IAB Europe): the standard way a CMP tells ad vendors what the visitor agreed to. Needs TCF enabled in the banner.' },
    { term: 'TC string', match: ['TC string'], text: 'The encoded TCF consent record: a long base64 string starting with "C" that lists the purposes and vendors the visitor allowed.' },
    { term: '__tcfapi', match: ['__tcfapi'], text: 'The TCF JavaScript API. getTCData returns the TC string and the vendor / purpose consents.' },
    { term: 'GPC', match: ['GPC', 'Global Privacy Control'], text: 'Global Privacy Control: a browser signal (navigator.globalPrivacyControl) saying the visitor opts out of sale / sharing. Banners should honor it.' },
    { term: 'doNotTrack (DNT)', match: ['doNotTrack', 'cookiebotDoNotTrack'], text: 'Older "Do Not Track" browser setting. Few sites honor it; Cookiebot only reports it.' },
    { term: 'GDPR', match: ['GDPR'], text: 'EU General Data Protection Regulation: consent is required before non-essential cookies (opt-in model).' },
    { term: 'CCPA', match: ['CCPA'], text: 'California Consumer Privacy Act: US state law about sale and sharing of personal data (opt-out model).' },
    { term: 'LGPD', match: ['LGPD'], text: 'Brazil\'s General Data Protection Law, similar to the GDPR.' },
    { term: 'Regulation', match: ['Regulation'], text: 'Which privacy law applies to this visitor (GDPR, CCPA, LGPD...). It decides opt-in vs opt-out behavior and what the banner shows.' },
    { term: 'consent id', match: ['consent id'], text: 'Identifier of this visitor\'s consent record, useful to find it again.' },
    { term: 'Bulk consent', match: ['Bulk consent ticket', 'Bulk consent', 'bulk consent', 'CookieConsentBulkTicket'], text: 'One consent shared across several domains. The ticket cookie links them: it must be the same value on every domain.' },
    { term: 'CookieConsent (cookie)', match: ['CookieConsent'], text: 'The cookie where the banner stores the choice: stamp, the 4 categories, method, version, time and region.' },
    { term: 'stamp', match: ['stamp'], text: 'Unique id of the stored consent record.' },
    { term: 'explicit', match: ['explicit'], text: 'Consent method "explicit": the visitor clicked Accept / Deny or saved choices.' },
    { term: 'implied', match: ['implied'], text: 'Consent method "implied": consent assumed without a click, where the law allows it.' },
    { term: 'Necessary', match: ['Necessary'], text: 'Cookies the site needs to work (session, security, the consent cookie itself). Always allowed; the visitor cannot refuse them.' },
    { term: 'Preferences', match: ['Preferences'], text: 'Cookies that remember choices such as language or region.' },
    { term: 'Statistics', match: ['Statistics'], text: 'Cookies that count visits and measure how the site is used, usually anonymously.' },
    { term: 'Marketing', match: ['Marketing'], text: 'Cookies for advertising and tracking across sites. The most restricted category: embeds like YouTube stay blocked until it is allowed.' },
    { term: 'hasResponse', match: ['hasResponse'], text: 'Cookiebot.hasResponse: true once the visitor answered the banner (or a valid earlier consent exists).' },
    { term: 'No answer yet', match: ['No answer yet'], text: 'The visitor has not answered the banner, so no optional cookie category is allowed.' },
    { term: 'PARTIAL consent', match: ['PARTIAL consent'], text: 'Some optional categories (Preferences, Statistics, Marketing) are allowed and some are not.' },
    { term: 'Cookies ACCEPTED', match: ['Cookies ACCEPTED'], text: 'All optional categories are allowed.' },
    { term: 'Cookies DECLINED', match: ['Cookies DECLINED'], text: 'Only the Necessary category is allowed.' },
    { term: 'localStorage', match: ['localStorage'], text: 'Browser key-value storage for this site that stays until cleared. Some banners keep consent data there.' },
    { term: 'second layer', match: ['second layer', '2nd layer'], text: 'The detailed view of the banner (categories, vendors, cookie list) shown after Customize / Details.' },

    // ---- banner setup & blocking ----
    { term: 'data-cbid', match: ['data-cbid', 'cbid'], text: 'Domain group ID: which Cookiebot configuration this page loads. The page\'s domain must belong to it or no banner shows.' },
    { term: 'Domain group', match: ['domain group'], text: 'In the Cookiebot Manager, the set of domains that share one banner configuration.' },
    { term: 'Blocking mode', match: ['data-blockingmode', 'blocking mode'], text: 'auto: Cookiebot holds back scripts and embeds until consent. manual: you mark each one yourself with type="text/plain" + data-cookieconsent.' },
    { term: 'data-cookieconsent', match: ['data-cookieconsent'], text: 'Attribute on a script / iframe saying which category must be allowed before it runs, e.g. data-cookieconsent="marketing".' },

    // ---- API calls ----
    { term: 'Cookiebot.show()', match: ['Cookiebot.show()', 'show()'], text: 'Opens the banner (its second layer if consent already exists).' },
    { term: 'Cookiebot.hide()', match: ['Cookiebot.hide()', 'hide()'], text: 'Closes the banner without answering.' },
    { term: 'Cookiebot.renew()', match: ['Cookiebot.renew()', 'renew()'], text: 'Re-creates the banner elements so the dialog shows again. Useful to check that new elements carry the CSP nonce.' },
    { term: 'Cookiebot.withdraw()', match: ['Cookiebot.withdraw()', 'withdraw()'], text: 'Starts the withdraw-consent flow, so the visitor can change or remove the earlier choice.' },
    { term: 'Cookiebot.runScripts()', match: ['Cookiebot.runScripts()', 'runScripts()'], text: 'Re-runs the scripts that were blocked, after consent changed, without reloading the page.' },

    // ---- events ----
    { term: 'page-start', match: ['page-start'], text: 'Lab marker: this page started loading (event-log.js ran). Everything after it belongs to this page load.' },
    { term: 'dom-ready', match: ['dom-ready'], text: 'The browser finished parsing the HTML (DOMContentLoaded).' },
    { term: 'window-load', match: ['window-load'], text: 'The page and all its resources finished loading (load event).' },
    { term: 'CookiebotOnLoad', match: ['CookiebotOnLoad'], text: 'The banner script finished loading; Cookiebot.consent is available.' },
    { term: 'CookiebotOnDialogInit', match: ['CookiebotOnDialogInit'], text: 'The banner dialog is being built, before it is shown.' },
    { term: 'CookiebotOnDialogDisplay', match: ['CookiebotOnDialogDisplay'], text: 'The banner was shown to the visitor.' },
    { term: 'CookiebotOnConsentReady', match: ['CookiebotOnConsentReady'], text: 'The consent state is known (earlier answer or a new one). The moment to run consent-based code.' },
    { term: 'CookiebotOnAccept', match: ['CookiebotOnAccept'], text: 'The visitor has accepted cookies (an optional category is allowed).' },
    { term: 'CookiebotOnDecline', match: ['CookiebotOnDecline'], text: 'The visitor declined: no optional category is allowed.' },
    { term: 'CookiebotOnTagsExecuted', match: ['CookiebotOnTagsExecuted'], text: 'Cookiebot ran the scripts it had been holding back.' },

    // ---- CSP ----
    { term: 'CSP', match: ['CSP'], text: 'Content Security Policy: rules telling the browser which scripts and styles it may run. Strict ones block anything without the right nonce.' },
    { term: 'nonce', match: ['nonce'], text: 'A one-time token put in the CSP and on each allowed script / style (nonce attribute). Only elements carrying it may run.' },
    { term: 'violation', match: ['violation', 'violations'], text: 'The browser blocked something the CSP does not allow. Reported by the securitypolicyviolation event.' },
    { term: 'script-src-elem', match: ['script-src-elem'], text: 'CSP directive: where <script> elements may load from. A violation names the directive that blocked it.' },
    { term: 'style-src', match: ['style-src'], text: 'CSP directive: where styles may come from (inline styles need the nonce).' },
    { term: 'Nonce audit', match: ['Nonce audit'], text: 'Checks every script / style in the page: elements created by the banner must carry the page nonce.' },

    // ---- accessibility & environment ----
    { term: 'axe-core', match: ['axe-core', 'axe'], text: 'Open-source accessibility engine (Deque). Runs rules (contrast, names, ARIA...) and lists violations.' },
    { term: 'WCAG 1.4.12', match: ['WCAG 1.4.12'], text: 'Text Spacing: nothing may be cut off or overlap when line height is 1.5, letter spacing 0.12em, word spacing 0.16em and paragraph spacing 2em.' },
    { term: 'WCAG 1.4.10', match: ['WCAG 1.4.10', 'reflow', 'Reflow'], text: 'Reflow: content must work at 320 CSS px wide (about 400% zoom) without horizontal scrolling or loss of content.' },
    { term: 'role="dialog"', match: ['role="dialog"'], text: 'ARIA role that makes screen readers announce the banner as a dialog. Expected for modal banners.' },
    { term: 'role="region"', match: ['role="region"'], text: 'ARIA role for a landmark area. Non-modal banner templates can use it instead of dialog.' },
    { term: 'aria-modal', match: ['aria-modal'], text: 'Tells screen readers the rest of the page is inert while the dialog is open. Only right for banners that really are modal.' },
    { term: 'accessible name', match: ['accessible name'], text: 'The label a screen reader announces for a control (text, aria-label, <label>...). A button without one is a critical failure.' },
    { term: 'tabindex', match: ['tabindex'], text: 'Controls keyboard focus order. 0 = natural order, -1 = focusable only by script, values above 0 break the natural order.' },
    { term: 'focus trap', match: ['focus trap'], text: 'Keeping Tab inside a modal dialog so focus cannot reach the page behind it.' },
    { term: 'devicePixelRatio', match: ['devicePixelRatio'], text: 'Device pixels per CSS pixel. It changes with browser zoom and high-density screens.' },
    { term: 'prefersReducedMotion', match: ['prefersReducedMotion'], text: 'The visitor asked the OS to minimize animation. The banner should not rely on motion then.' },
    { term: 'colorScheme', match: ['colorScheme'], text: 'The OS light / dark preference (prefers-color-scheme).' },
    { term: 'forcedColors', match: ['forcedColors'], text: 'Windows High Contrast mode: the system overrides colors. Check the banner stays readable.' },
    { term: 'prefersContrastMore', match: ['prefersContrastMore'], text: 'The visitor asked the OS for more contrast.' },
    { term: 'coarsePointer', match: ['coarsePointer'], text: 'A touch-like pointer (finger): controls need big enough tap targets.' },
    { term: 'webdriver', match: ['webdriver'], text: 'navigator.webdriver is true in automated browsers (Selenium, Playwright...). Some CMPs do not show the banner to automation.' },

    // ---- tooling ----
    { term: 'Xray', match: ['Xray'], text: 'Test management app in Jira. The JSON exports of this lab are meant to be attached as test evidence.' }
  ];

  var lookup = {};
  var alternatives = [];
  GLOSSARY.forEach(function (entry) {
    entry.match.forEach(function (m) { lookup[m] = entry; alternatives.push(m); });
  });
  alternatives.sort(function (a, b) { return b.length - a.length; }); // longest first
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var TERM_RE = new RegExp('(?<![\\w-])(' + alternatives.map(escapeRe).join('|') + ')(?![\\w-])', 'g');

  // Text inside these is never wrapped
  var SKIP = 'pre, button, a, input, textarea, select, option, script, style, summary, abbr, [data-tip], #glossary, .lab-log-head, iframe, footer, nav';
  var BLOCK = 'div, p, li, td, th, main';

  function explain(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) {
      if (!n.nodeValue || !n.nodeValue.trim()) continue;
      var parent = n.parentElement;
      if (!parent || parent.closest(SKIP)) continue;
      nodes.push(n);
    }

    var seen = new Map(); // block -> Set of terms already marked in it
    function termsIn(block) {
      if (!seen.has(block)) {
        var set = new Set();
        block.querySelectorAll('.lab-term[data-term]').forEach(function (a) { set.add(a.getAttribute('data-term')); });
        seen.set(block, set);
      }
      return seen.get(block);
    }

    nodes.forEach(function (node) {
      var text = node.nodeValue;
      var block = node.parentElement.closest(BLOCK) || node.parentElement;
      var used = termsIn(block);
      var frag = null;
      var last = 0;
      var m;
      TERM_RE.lastIndex = 0;
      while ((m = TERM_RE.exec(text))) {
        var entry = lookup[m[1]];
        if (!entry || used.has(entry.term)) continue;
        used.add(entry.term);
        if (!frag) frag = document.createDocumentFragment();
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        frag.appendChild(el('abbr', {
          class: 'lab-term', tabindex: '0', 'data-term': entry.term, tip: entry.text,
          'aria-description': entry.text, text: m[1]
        }));
        last = m.index + m[1].length;
      }
      if (frag) {
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      }
    });
  }

  // ---- glossary list with filter ----
  function buildGlossary(root) {
    var items = GLOSSARY.slice().sort(function (a, b) { return a.term.toLowerCase().localeCompare(b.term.toLowerCase()); });
    var filter = el('input', { type: 'text', class: 'lab-input', placeholder: 'filter terms...', 'aria-label': 'Filter glossary', tip: 'Type part of a term or of its explanation' });
    var count = el('span', { class: 'lab-hint' });
    var empty = el('div', { class: 'lab-hint lab-hidden', text: 'No term matches.' });
    var rows = items.map(function (e) {
      var row = el('div', { class: 'lab-gloss-item' }, [el('strong', { text: e.term }), el('div', { text: e.text })]);
      row.setAttribute('data-search', (e.term + ' ' + e.match.join(' ') + ' ' + e.text).toLowerCase());
      return row;
    });
    function apply() {
      var q = filter.value.trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (r) {
        var ok = !q || r.getAttribute('data-search').indexOf(q) !== -1;
        r.classList.toggle('lab-hidden', !ok);
        if (ok) shown++;
      });
      count.textContent = shown + ' of ' + rows.length + ' terms';
      empty.classList.toggle('lab-hidden', shown !== 0);
    }
    filter.addEventListener('input', apply);
    root.appendChild(el('div', { class: 'lab-toolbar' }, [filter, count]));
    rows.forEach(function (r) { root.appendChild(r); });
    root.appendChild(empty);
    apply();
  }

  // ---- tooltip flips left when it would leave the screen on the right ----
  function placeTip(e) {
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) return;
    var r = t.getBoundingClientRect();
    t.classList.toggle('tip-left', r.left + 270 > window.innerWidth - 8);
  }

  Lab.ready(function () {
    var glossaryRoot = document.getElementById('glossary');
    if (glossaryRoot) buildGlossary(glossaryRoot);

    var main = document.querySelector('main') || document.body;
    var observer = new MutationObserver(function () { schedule(); });
    var timer = null;
    function run() {
      timer = null;
      observer.disconnect(); // our own changes must not trigger another pass
      try { explain(main); } finally { observer.observe(main, { childList: true, subtree: true }); }
    }
    function schedule() { if (!timer) timer = setTimeout(run, 80); }
    run();

    document.addEventListener('mouseover', placeTip);
    document.addEventListener('focusin', placeTip);
  });

  Lab.glossary = GLOSSARY;
})();
