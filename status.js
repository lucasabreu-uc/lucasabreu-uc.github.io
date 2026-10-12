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
