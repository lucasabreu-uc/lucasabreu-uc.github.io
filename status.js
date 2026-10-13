// Detects real status of marketing services (YouTube, Vimeo, SoundCloud)
// Cookiebot automatically swaps data-src -> src once the user accepts
// the "marketing" category (thanks to the data-cookieconsent="marketing" attribute).
const services = [
  { id: 'dot-yt',    frame: 'frame-yt-nc' },
  { id: 'dot-vimeo', frame: 'frame-vimeo' },
  { id: 'dot-sc',    frame: 'frame-sc' }
];

function updateStatus() {
  services.forEach(function (s) {
    const dot = document.getElementById(s.id);
    const frame = document.getElementById(s.frame);
    if (!dot || !frame) return;

    const hasLoaded = !!frame.getAttribute('src');
    dot.classList.remove('loaded', 'blocked');
    dot.classList.add(hasLoaded ? 'loaded' : 'blocked');
    dot.title = hasLoaded ? 'Loaded' : 'Blocked (awaiting consent)';
  });
}

// Initial state (before the user responds to the banner)
document.addEventListener('DOMContentLoaded', updateStatus);

// Cookiebot fires these global events when the user accepts/declines
window.addEventListener('CookiebotOnAccept', updateStatus);
window.addEventListener('CookiebotOnDecline', updateStatus);
window.addEventListener('CookiebotOnConsentReady', updateStatus);

// Removes the stored consent cookie so the banner shows again on reload
function clearConsent() {
  var host = location.hostname;
  ['CookieConsent', 'CookieConsentBulkTicket'].forEach(function (name) {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + host;
  });
  location.reload();
}

// Clears every cookie and storage this site can reach, then reloads
async function clearAllSiteData() {
  if (!confirm('Clear all cookies and site data for this site?')) return;

  // Cookies: expire each one across every path/domain variant (JS can't see HttpOnly ones)
  var parts = location.hostname.split('.');
  var domains = [undefined];
  for (var i = 0; i < parts.length - 1; i++) {
    var d = parts.slice(i).join('.');
    domains.push(d, '.' + d);
  }
  var segs = location.pathname.split('/').filter(Boolean);
  var paths = ['/'];
  segs.reduce(function (acc, s) { acc += '/' + s; paths.push(acc); return acc; }, '');
  document.cookie.split(';').forEach(function (c) {
    var name = c.split('=')[0].trim();
    if (!name) return;
    domains.forEach(function (dom) {
      paths.forEach(function (p) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=' + p + (dom ? '; domain=' + dom : '');
      });
    });
  });

  try { localStorage.clear(); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  try {
    if (indexedDB.databases) {
      (await indexedDB.databases()).forEach(function (db) { indexedDB.deleteDatabase(db.name); });
    }
  } catch (e) {}
  try {
    if (window.caches) (await caches.keys()).forEach(function (k) { caches.delete(k); });
  } catch (e) {}
  try {
    if (navigator.serviceWorker) {
      (await navigator.serviceWorker.getRegistrations()).forEach(function (r) { r.unregister(); });
    }
  } catch (e) {}

  location.reload();
}

// ---- Consent status panel: shows what the user actually chose in the banner ----
(function () {
  var CATS = ['necessary', 'preferences', 'statistics', 'marketing'];

  function log(msg) {
    var ul = document.getElementById('consent-log');
    if (!ul) return;
    var li = document.createElement('li');
    li.textContent = new Date().toLocaleTimeString() + '  ' + msg;
    ul.insertBefore(li, ul.firstChild);
  }

  function renderConsent() {
    var panel = document.getElementById('consent-panel');
    if (!panel) return;
    var cb = window.Cookiebot;
    var badge = panel.querySelector('.badge');
    var meta = document.getElementById('consent-meta');
    var state, text;

    if (!cb) {
      state = 'nobanner'; text = 'No banner script loaded';
      meta.textContent = 'Cookiebot is not on this page. Paste the banner script in the <head>.';
    } else if (!cb.hasResponse) {
      state = 'pending'; text = 'No answer yet';
      meta.textContent = 'The user has not responded to the banner.';
    } else {
      var c = cb.consent || {};
      var optional = CATS.filter(function (k) { return k !== 'necessary'; });
      var allowed = optional.filter(function (k) { return c[k]; }).length;
      if (allowed === optional.length) { state = 'accepted'; text = 'Cookies ACCEPTED'; }
      else if (allowed === 0)          { state = 'declined'; text = 'Cookies DECLINED (necessary only)'; }
      else                             { state = 'partial';  text = 'PARTIAL consent'; }
      meta.textContent = 'Method: ' + (c.method || 'n/a') + (cb.consentUTC ? ' · Date: ' + cb.consentUTC : '');
    }

    panel.className = 'card ' + state;
    badge.textContent = text;
    CATS.forEach(function (k) {
      var el = document.getElementById('cat-' + k);
      if (!el) return;
      var on = !!(window.Cookiebot && window.Cookiebot.hasResponse && window.Cookiebot.consent && window.Cookiebot.consent[k]);
      el.querySelector('.dot').className = 'dot ' + (on ? 'on' : 'off');
      el.querySelector('.val').textContent = on ? 'allowed' : 'not allowed';
    });
  }

  [['CookiebotOnDialogDisplay', 'Banner displayed'],
   ['CookiebotOnConsentReady', 'Consent ready'],
   ['CookiebotOnAccept', 'User accepted'],
   ['CookiebotOnDecline', 'User declined / changed']].forEach(function (e) {
    window.addEventListener(e[0], function () { log(e[1]); renderConsent(); });
  });

  document.addEventListener('DOMContentLoaded', function () {
    renderConsent();
    log(window.Cookiebot ? 'Page loaded (Cookiebot found)' : 'Page loaded (no Cookiebot)');
  });
  window.addEventListener('load', renderConsent);
})();

// ---- Cookie declaration: lists every cookie the banner knows about, per category ----
// Built from the page's own Cookiebot <script id="Cookiebot"> (same domain + cbid),
// so each banner page shows its own scan result.
// Also called by the "Refresh" button of that section: it re-injects cd.js so the
// list (and the consent status inside it) is rebuilt without reloading the page.
function loadCookieDeclaration() {
  var box = document.getElementById('cookie-declaration');
  var msg = document.getElementById('cookie-declaration-msg');
  if (!box) return;

  var tag = document.getElementById('Cookiebot');
  if (!tag || !tag.src || !tag.getAttribute('data-cbid')) {
    box.style.display = 'none';
    msg.textContent = 'No banner script on this page yet, so there is no cookie list to show.';
    return;
  }

  box.style.display = '';
  box.textContent = '';
  var url = new URL(tag.src).origin + '/' + tag.getAttribute('data-cbid') + '/cd.js';
  var s = document.createElement('script');
  s.id = 'CookieDeclaration';
  s.type = 'text/javascript';
  s.async = true;
  s.src = url;
  s.setAttribute('data-culture', 'EN');
  s.onerror = function () {
    box.style.display = 'none';
    msg.textContent = 'Could not load the cookie list from ' + url;
  };
  box.appendChild(s);
  msg.textContent = 'Loaded from ' + url + ' at ' + new Date().toLocaleTimeString();
}
document.addEventListener('DOMContentLoaded', loadCookieDeclaration);

// ---- Section "Refresh" buttons (Service Status, Media Embeds) ----
// Cookiebot swaps data-src -> src a moment AFTER the consent event, so the dots are
// re-checked a few times after every answer. The buttons do the same on demand.
function refreshServiceStatus() {
  updateStatus();
}

// Re-runs blocked scripts and reloads the embeds that already loaded.
// Embeds still blocked after this need a full page reload ("Reload page").
function reloadEmbeds() {
  if (window.Cookiebot && typeof window.Cookiebot.runScripts === 'function') window.Cookiebot.runScripts();
  document.querySelectorAll('iframe[data-cookieconsent]').forEach(function (f) {
    var src = f.getAttribute('src');
    if (src) f.setAttribute('src', src);
  });
  setTimeout(updateStatus, 800);
}

['CookiebotOnAccept', 'CookiebotOnDecline', 'CookiebotOnConsentReady'].forEach(function (name) {
  window.addEventListener(name, function () {
    setTimeout(updateStatus, 600);
    setTimeout(updateStatus, 2000);
  });
});
