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
