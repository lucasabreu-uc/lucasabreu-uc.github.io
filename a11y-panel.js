// ITEM 7 - Accessibility & Layout
// Mount point: <div id="a11y-panel"></div>
// Helps with the accessibility / layout scenarios of the banner (Cookiebot dialog only,
// not the lab page itself):
//   - axe-core run scoped to the banner (loaded from vendor/ on first click, CSP-safe)
//   - static audit: role, aria-modal, accessible names, positive tabindex
//   - live focus tracker (Tab / Shift+Tab order, is focus inside the banner?)
//   - layout stress: WCAG 1.4.12 text spacing, banner zoom, 320px popup window (reflow)
//   - read-only environment info (viewport, reduced motion, color scheme, forced colors)
// Built with Lab.el only (no innerHTML / inline styles): works on the strict-CSP pages too.
(function () {
  var el = Lab.el;
  var DIALOG_ID = 'CybotCookiebotDialog';
  var AXE_SRC = 'vendor/axe.min.js?v=4.10.2';
  var INTERACTIVE = 'a[href], button, input:not([type="hidden"]), select, textarea, ' +
    '[role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="tab"], [tabindex]:not([tabindex="-1"])';

  var boxes = {};
  var lastAudit = null;
  var lastAxe = null;
  var focusHistory = [];
  var layout = { spacing: false, zoom: '100' };

  // ---- small DOM helpers ----
  function dialog() { return document.getElementById(DIALOG_ID); }
  function visible(n) { return !!(n && n.getClientRects().length); }
  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  // Short CSS-ish description: tag#id.class
  function describe(n) {
    if (!n || !n.tagName) return '(none)';
    var d = n.tagName.toLowerCase();
    if (n.id) d += '#' + n.id;
    else if (typeof n.className === 'string' && n.className.trim()) d += '.' + n.className.trim().split(/\s+/)[0];
    return d;
  }

  // Simplified accessible name: aria-labelledby > aria-label > alt > label/value > text > title
  function accName(n) {
    var by = n.getAttribute('aria-labelledby');
    if (by) {
      var t = by.split(/\s+/).map(function (id) { var r = document.getElementById(id); return r ? clean(r.textContent) : ''; }).join(' ').trim();
      if (t) return t;
    }
    if (clean(n.getAttribute('aria-label'))) return clean(n.getAttribute('aria-label'));
    if (n.tagName === 'IMG' && n.hasAttribute('alt')) return clean(n.getAttribute('alt'));
    if (n.labels && n.labels.length) {
      var l = Array.prototype.map.call(n.labels, function (x) { return clean(x.textContent); }).join(' ').trim();
      if (l) return l;
    }
    if (n.tagName === 'INPUT' && /^(button|submit|reset)$/.test(n.type) && clean(n.value)) return clean(n.value);
    var txt = clean(n.textContent);
    if (txt) return txt;
    return clean(n.getAttribute('title'));
  }

  // ---- static audit of the banner DOM ----
  function audit() {
    var d = dialog();
    var rows = [];
    function add(ok, label, msg) { rows.push({ ok: ok, label: label, msg: msg }); }

    if (!d) {
      add(false, 'Banner in DOM', 'not found (#' + DIALOG_ID + '). Use "Open banner" first.');
      return { found: false, rows: rows };
    }
    add(visible(d), 'Banner visible', visible(d) ? 'yes' : 'in the DOM but hidden. Use "Open banner"');

    var roleEl = d.matches('[role="dialog"], [role="alertdialog"]') ? d : d.querySelector('[role="dialog"], [role="alertdialog"]');
    add(!!roleEl, 'role="dialog"', roleEl ? 'found on ' + describe(roleEl)
      : 'banner root has role="' + (d.getAttribute('role') || 'none') + '" (dialog / alertdialog expected for modal banners; region can be intended for non-modal templates)');

    var modalEl = d.matches('[aria-modal]') ? d : d.querySelector('[aria-modal]');
    add(!!modalEl && modalEl.getAttribute('aria-modal') === 'true', 'aria-modal',
      modalEl ? 'aria-modal="' + modalEl.getAttribute('aria-modal') + '"' : 'not set (only a finding if the banner is meant to be modal)');

    var named = roleEl || d;
    var dName = accName(named);
    var dNameFromAttr = clean(named.getAttribute('aria-label')) || named.getAttribute('aria-labelledby');
    add(!!dNameFromAttr, 'Dialog accessible name', dNameFromAttr ? 'aria-label / aria-labelledby: "' + dName.slice(0, 60) + '"' : 'no aria-label or aria-labelledby on the dialog');

    var items = Array.prototype.filter.call(d.querySelectorAll(INTERACTIVE), visible);
    add(items.length > 0, 'Focusable controls', items.length + ' visible control(s)');

    var unnamed = items.filter(function (n) { return !accName(n); });
    add(unnamed.length === 0, 'Controls with accessible name',
      unnamed.length === 0 ? 'all ' + items.length + ' named'
        : unnamed.length + ' without name: ' + unnamed.slice(0, 5).map(describe).join(', '));

    var positive = Array.prototype.filter.call(d.querySelectorAll('[tabindex]'), function (n) { return Number(n.getAttribute('tabindex')) > 0; });
    add(positive.length === 0, 'Positive tabindex', positive.length === 0 ? 'none' : positive.length + ' element(s): ' + positive.slice(0, 5).map(describe).join(', '));

    var noAlt = Array.prototype.filter.call(d.querySelectorAll('img'), function (n) { return !n.hasAttribute('alt'); });
    add(noAlt.length === 0, 'Images with alt', noAlt.length === 0 ? 'all have alt' : noAlt.length + ' image(s) without alt');

    return { found: true, rows: rows };
  }

  function renderAudit() {
    lastAudit = audit();
    var box = boxes.audit;
    box.textContent = '';
    box.appendChild(el('strong', { text: 'Static audit' }));
    box.appendChild(el('div', { class: 'lab-hint', text: 'Quick checks on the banner DOM at ' + new Date().toLocaleTimeString() + '. axe below covers the rest (contrast, ARIA rules...).' }));
    lastAudit.rows.forEach(function (r) {
      box.appendChild(el('div', { class: 'lab-check ' + (r.ok ? 'ok' : 'bad'), text: (r.ok ? 'PASS: ' : 'CHECK: ') + r.label + ' - ' + r.msg }));
    });
  }

  // ---- axe-core (loaded lazily from vendor/, 'self' so strict CSP allows it) ----
  var axePromise = null;
  function loadAxe() {
    if (window.axe) return Promise.resolve(window.axe);
    if (!axePromise) {
      axePromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        // Same nonce as the page, in case the CSP asks for it
        var withNonce = document.querySelector('script[nonce]');
        if (withNonce && withNonce.nonce) s.nonce = withNonce.nonce;
        s.src = AXE_SRC;
        s.onload = function () { resolve(window.axe); };
        s.onerror = function () { axePromise = null; reject(new Error('could not load ' + AXE_SRC)); };
        document.head.appendChild(s);
      });
    }
    return axePromise;
  }

  function renderAxe(result, error) {
    var box = boxes.axe;
    box.textContent = '';
    box.appendChild(el('strong', { text: 'axe-core (banner only)' }));
    if (error) {
      box.appendChild(el('div', { class: 'lab-check bad', text: 'ERROR: ' + error }));
      return;
    }
    if (!result) {
      box.appendChild(el('div', { class: 'lab-hint', text: 'Not run yet. Click "Run axe on banner". Open the banner first, axe only sees what is in the DOM.' }));
      return;
    }
    var counts = {};
    result.violations.forEach(function (v) { counts[v.impact] = (counts[v.impact] || 0) + 1; });
    var summary = Object.keys(counts).map(function (k) { return counts[k] + ' ' + k; }).join(', ');
    box.appendChild(el('div', { class: 'lab-hint', text: 'Run at ' + result.ranAt + '. axe ' + result.axeVersion + ', ' + result.passes + ' rule(s) passed, ' + result.incomplete.length + ' need manual review.' }));
    box.appendChild(el('div', { class: 'lab-check ' + (result.violations.length === 0 ? 'ok' : 'bad'),
      text: (result.violations.length === 0 ? 'PASS' : 'FAIL') + ': ' + result.violations.length + ' violation(s)' + (summary ? ' (' + summary + ')' : '') }));

    function list(items, title, cls) {
      if (!items.length) return;
      box.appendChild(el('div', { class: 'lab-hint', text: title }));
      items.forEach(function (v) {
        var entry = el('div', { class: 'lab-log-entry ' + cls }, [
          el('div', { class: 'lab-log-head', text: (v.impact || 'n/a') + '  ' + v.id + '  (' + v.nodes.length + ' element(s))' }),
          el('div', { text: v.help })
        ]);
        v.nodes.slice(0, 5).forEach(function (n) {
          entry.appendChild(el('pre', { class: 'lab-pre', text: n.target.join(' ') + '\n' + n.html.slice(0, 160) }));
        });
        entry.appendChild(el('a', { href: v.helpUrl, target: '_blank', rel: 'noopener', text: 'Rule details' }));
        box.appendChild(entry);
      });
    }
    list(result.violations, 'Violations', 'bad');
    list(result.incomplete, 'Needs manual review (axe could not decide)', '');
  }

  function runAxe() {
    var d = dialog();
    if (!d || !visible(d)) {
      renderAxe(null, 'Banner not visible. Click "Open banner" first, then run axe again.');
      return;
    }
    loadAxe().then(function (axe) {
      return axe.run(d, { resultTypes: ['violations', 'incomplete'] }).then(function (r) {
        // Keep the JSON small: ids, impact, targets only
        lastAxe = {
          ranAt: new Date().toLocaleTimeString(),
          axeVersion: axe.version,
          passes: r.passes ? r.passes.length : 0,
          violations: slim(r.violations),
          incomplete: slim(r.incomplete)
        };
        renderAxe(lastAxe);
      });
    }).catch(function (e) { renderAxe(null, String(e && e.message || e)); });
  }
  function slim(list) {
    return (list || []).map(function (v) {
      return { id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
        nodes: v.nodes.map(function (n) { return { target: n.target, html: n.html }; }) };
    });
  }

  // ---- focus tracker ----
  function describeFocus(n) {
    var label = accName(n);
    return describe(n) + (label ? ' "' + label.slice(0, 40) + '"' : '');
  }
  function renderFocus() {
    var box = boxes.focus;
    box.textContent = '';
    var head = el('div', { class: 'lab-section-head' }, [
      el('strong', { text: 'Focus tracker' }),
      Lab.button('Clear', function () { focusHistory = []; renderFocus(); }, 'lab-btn-small', 'Empty the focus history')
    ]);
    box.appendChild(head);
    box.appendChild(el('div', { class: 'lab-hint', text: 'Press Tab / Shift+Tab (or click "Open banner" and then Tab). Newest first. Check order, that every control is reached, and that focus is visible.' }));
    // Fixed height: when focus changes the log must not grow, or the controls below
    // would jump away from under the mouse in the middle of a click.
    var log = el('div', { class: 'lab-log lab-a11y-focuslog' });
    if (!focusHistory.length) log.appendChild(el('div', { class: 'lab-hint', text: 'No focus change recorded yet.' }));
    focusHistory.forEach(function (f) {
      log.appendChild(el('div', { class: 'lab-log-entry ' + (f.inBanner ? 'ok' : '') }, [
        el('div', { class: 'lab-log-head', text: f.time + '  ' + (f.inBanner ? 'inside banner' : 'outside banner') }),
        el('div', { text: f.desc })
      ]));
    });
    box.appendChild(log);
  }
  function onFocusIn(e) {
    var t = e.target;
    if (!t || t === document || t === document.body) return;
    var d = dialog();
    focusHistory.unshift({
      time: new Date().toLocaleTimeString(),
      desc: describeFocus(t),
      inBanner: !!(d && d.contains(t))
    });
    if (focusHistory.length > 20) focusHistory.length = 20;
    renderFocus();
  }

  // ---- layout stress (CSS lives in style.css, toggled by classes on <html>) ----
  function applyLayout() {
    var root = document.documentElement;
    root.classList.toggle('lab-a11y-spacing', layout.spacing);
    ['150', '200'].forEach(function (z) { root.classList.toggle('lab-a11y-zoom-' + z, layout.zoom === z); });
  }
  function renderLayout() {
    var box = boxes.layout;
    box.textContent = '';
    box.appendChild(el('strong', { text: 'Layout stress (banner only)' }));
    box.appendChild(el('div', { class: 'lab-hint', text: 'Applies to the banner while it is open. Resets on page reload.' }));

    var spacing = el('input', { type: 'checkbox', id: 'a11y-spacing' });
    spacing.checked = layout.spacing;
    spacing.addEventListener('change', function () { layout.spacing = spacing.checked; applyLayout(); });

    var zoom = el('select', { id: 'a11y-zoom', class: 'lab-input', 'aria-label': 'Banner zoom', tip: 'Scales the banner (CSS zoom), a rough stand-in for large text' },
      ['100', '150', '200'].map(function (z) { return el('option', { value: z, text: z + '%' }); }));
    zoom.value = layout.zoom;
    zoom.addEventListener('change', function () { layout.zoom = zoom.value; applyLayout(); });

    box.appendChild(el('div', { class: 'lab-row' }, [
      el('label', { class: 'lab-inline', for: 'a11y-spacing', tip: 'WCAG 1.4.12: line-height 1.5, letter-spacing 0.12em, word-spacing 0.16em, paragraph spacing 2em. Nothing may be cut off or overlap' },
        [spacing, el('span', { text: ' Text spacing (WCAG 1.4.12)' })]),
      el('label', { class: 'lab-inline', for: 'a11y-zoom' }, [el('span', { text: 'Banner zoom ' }), zoom]),
      Lab.button('Open 320px window', function () {
        window.open(location.href, 'lab-320', 'width=320,height=640');
      }, '', 'Reflow check (WCAG 1.4.10): new window 320px wide. Use "Clear consent" there to see the banner')
    ]));
  }

  // ---- environment (read-only) ----
  function env() {
    function mq(q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } }
    return {
      viewport: window.innerWidth + ' x ' + window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      prefersReducedMotion: mq('(prefers-reduced-motion: reduce)'),
      colorScheme: mq('(prefers-color-scheme: dark)') ? 'dark' : 'light',
      forcedColors: mq('(forced-colors: active)'),
      prefersContrastMore: mq('(prefers-contrast: more)'),
      coarsePointer: mq('(pointer: coarse)')
    };
  }
  function renderEnv() {
    var box = boxes.env;
    box.textContent = '';
    box.appendChild(el('strong', { text: 'Environment' }));
    box.appendChild(el('div', { class: 'lab-hint', text: 'Read-only: change these in the OS / browser (or DevTools Rendering tab) and click Refresh.' }));
    var data = env();
    Object.keys(data).forEach(function (k) {
      box.appendChild(el('div', { text: k + ': ' + data[k] }));
    });
  }

  // ---- panel ----
  function refresh() { renderAudit(); renderEnv(); }

  function build(root) {
    ['toolbar', 'layout', 'focus', 'audit', 'axe', 'env'].forEach(function (k) {
      boxes[k] = el('div', { class: 'lab-section' });
      root.appendChild(boxes[k]);
    });

    boxes.toolbar.className = 'lab-toolbar';
    boxes.toolbar.appendChild(Lab.button('Open banner', function () {
      if (window.Cookiebot && typeof window.Cookiebot.show === 'function') window.Cookiebot.show();
      setTimeout(refresh, 800);
    }, '', 'Cookiebot.show(): the banner must be in the DOM for the audit and axe'));
    boxes.toolbar.appendChild(Lab.button('Run axe on banner', runAxe, '', 'accessibility rules (contrast, ARIA, names...) on the banner only'));
    boxes.toolbar.appendChild(Lab.button('Copy all as JSON', function (e) {
      Lab.copy(Lab.pretty({ collectedAt: new Date().toISOString(), layout: layout, env: env(), audit: lastAudit, axe: lastAxe, focusHistory: focusHistory }), e.target);
    }, '', 'Copy audit + axe + focus + environment, paste it as Xray evidence'));

    renderAxe(null);
    renderFocus();
    renderLayout();
    refresh();
  }

  Lab.ready(function () {
    var root = document.getElementById('a11y-panel');
    if (!root) return;
    build(root);
    Lab.summaryButton(root, '↻ Refresh', refresh, 'Re-run the static audit and re-read the environment');
    document.addEventListener('focusin', onFocusIn);
    window.addEventListener('resize', renderEnv);
    // The banner appears a moment after the events, so audit again a couple of times
    Lab.onCookiebotEvents(function () { setTimeout(refresh, 400); setTimeout(refresh, 1500); });
    window.addEventListener('load', function () { setTimeout(refresh, 1500); });
  });
})();
