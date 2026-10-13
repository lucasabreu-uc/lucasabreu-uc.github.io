// ITEM 8 - Event Log panel
// Mount point: <div id="event-log"></div>. Data comes from event-log.js (loaded in <head>).
// Shows every Cookiebot event with time, ms since page start and the consent state at that
// moment, plus the buttons that export JSON for Xray:
//   - Copy / Download event log
//   - Download full report: every panel's data (inspector, API calls, accessibility,
//     test context, events) in one file, collected through Lab.registerExport.
(function () {
  var el = Lab.el;
  var root, listBox;

  function consentText(c) {
    if (!c) return 'no Cookiebot object yet';
    if (!c.hasResponse) return 'no answer yet';
    return 'N:' + (c.necessary ? 'y' : 'n') + ' P:' + (c.preferences ? 'y' : 'n') +
      ' S:' + (c.statistics ? 'y' : 'n') + ' M:' + (c.marketing ? 'y' : 'n') + (c.method ? ' (' + c.method + ')' : '');
  }

  function stamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }

  function events() { return window.LabEvents ? window.LabEvents.all() : []; }

  function renderList() {
    var list = events();
    listBox.textContent = '';
    if (!window.LabEvents) {
      listBox.appendChild(el('div', { class: 'lab-check bad', text: 'event-log.js is not loaded in the <head>: early events are not being recorded.' }));
      return;
    }
    if (!list.length) {
      listBox.appendChild(el('div', { class: 'lab-hint', text: 'No events recorded yet.' }));
      return;
    }
    list.slice().reverse().forEach(function (e) {
      var isStart = e.event === 'page-start';
      listBox.appendChild(el('div', { class: 'lab-log-entry ' + (isStart ? '' : 'ok') }, [
        el('div', { class: 'lab-log-head', text: e.time.slice(11, 23) + '  +' + e.ms + 'ms  ' + e.page }),
        el('div', { text: (isStart ? '--- page load: ' : '') + e.event + (isStart ? ' ---' : '') }),
        el('div', { class: 'lab-hint', text: consentText(e.cookiebot) })
      ]));
    });
  }

  function build() {
    var toolbar = el('div', { class: 'lab-toolbar' }, [
      Lab.button('Copy log as JSON', function (e) { Lab.copy(Lab.pretty(events()), e.target); }, '', 'Copy the event log, paste it as Xray evidence'),
      Lab.button('Download log', function () { Lab.download('cookiebot-events-' + stamp() + '.json', Lab.pretty(events())); }, '', 'Save the event log as a .json file'),
      Lab.button('Download full report', function () { Lab.download('banner-test-report-' + stamp() + '.json', Lab.pretty(Lab.report())); }, '', 'One file with every panel: inspector, API calls, accessibility, context, events'),
      Lab.button('Clear log', function () { if (window.LabEvents) window.LabEvents.clear(); }, 'lab-btn-small', 'Empty the event log (also forgets earlier page loads)')
    ]);
    listBox = el('div', { class: 'lab-log' });
    root.appendChild(toolbar);
    root.appendChild(el('div', { class: 'lab-hint', text: 'Newest first. Kept across reloads in this tab. "page-start" marks each page load; N/P/S/M = Necessary / Preferences / Statistics / Marketing (y = allowed).' }));
    root.appendChild(listBox);
  }

  Lab.ready(function () {
    root = document.getElementById('event-log');
    if (!root) return;
    build();
    renderList();
    Lab.registerExport('events', events);
    if (window.LabEvents) window.LabEvents.onChange(renderList);
    Lab.summaryButton(root, '↻ Refresh', renderList, 'Re-read the recorded events');
  });
})();
