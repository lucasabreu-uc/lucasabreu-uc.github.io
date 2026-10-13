// ITEM 8 - Event recorder (no UI here, see events-panel.js)
// MUST load in the <head> BEFORE the banner script: Cookiebot fires some events
// (OnLoad, OnDialogInit, OnDialogDisplay...) before the rest of the page is ready,
// and a listener registered later would miss them.
// Entries survive reloads (sessionStorage, same tab) so you can follow the whole
// sequence "clear consent -> reload -> banner -> answer". Standalone: no dependencies.
(function () {
  var KEY = 'lab-events';
  var MAX = 200;
  var EVENTS = [
    'CookiebotOnLoad', 'CookiebotOnDialogInit', 'CookiebotOnDialogDisplay',
    'CookiebotOnConsentReady', 'CookiebotOnAccept', 'CookiebotOnDecline', 'CookiebotOnTagsExecuted'
  ];
  var entries = [];
  var listeners = [];

  try {
    entries = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    if (!Array.isArray(entries)) entries = [];
  } catch (e) { entries = []; }

  // What Cookiebot reports at the moment of the event
  function snapshot() {
    var cb = window.Cookiebot;
    if (!cb) return null;
    var c = cb.consent || {};
    return {
      hasResponse: !!cb.hasResponse,
      necessary: !!c.necessary,
      preferences: !!c.preferences,
      statistics: !!c.statistics,
      marketing: !!c.marketing,
      method: c.method || null
    };
  }

  function add(name) {
    entries.push({
      time: new Date().toISOString(),
      ms: Math.round(performance.now()), // since this page started loading
      page: location.pathname.split('/').pop() || 'index.html',
      event: name,
      cookiebot: snapshot()
    });
    if (entries.length > MAX) entries.splice(0, entries.length - MAX);
    try { sessionStorage.setItem(KEY, JSON.stringify(entries)); } catch (e) {}
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  add('page-start');
  EVENTS.forEach(function (name) { window.addEventListener(name, function () { add(name); }); });
  document.addEventListener('DOMContentLoaded', function () { add('dom-ready'); });
  window.addEventListener('load', function () { add('window-load'); });

  window.LabEvents = {
    all: function () { return entries.slice(); },
    clear: function () {
      entries = [];
      try { sessionStorage.removeItem(KEY); } catch (e) {}
      listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
    },
    onChange: function (fn) { listeners.push(fn); }
  };
})();
