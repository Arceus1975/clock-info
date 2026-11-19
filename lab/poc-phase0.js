// Phase 0 probe, run as the registered receiver on the clock.
//
// Four questions, all cheap and none of them touching device state:
//   A1  does the receiver get a microphone?        (would satisfy the real goal)
//   A2  is that microphone usable for a recording?
//   E1  can a Service Worker register and activate? (persistence multiplier)
//   F1  is file:// reachable by any means other than fetch()?
//
// Every result is reported through the device log, prefixed [clocklab].
var print = (typeof print === 'function') ? print : function () { };
var TAG = '[phase0] ';
function say(s) { print(TAG + s); }

function timeout(ms, label) {
  return new Promise(function (res) { setTimeout(function () { res('timeout:' + label); }, ms); });
}
function race(promise, ms, label) {
  return Promise.race([promise, timeout(ms, label)]);
}

// ---------------------------------------------------------------- A1: mic ---
function probeDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return Promise.resolve('no-mediaDevices');
  }
  return navigator.mediaDevices.enumerateDevices().then(function (list) {
    var desc = list.map(function (d) {
      return d.kind + ':' + (d.label || '(no label)');
    });
    say('devices count=' + list.length + ' [' + desc.join(' | ') + ']');
    return 'ok';
  }).catch(function (e) { return 'ERR ' + (e && e.name); });
}

function probeGetUserMedia() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return Promise.resolve('no-getUserMedia');
  }
  return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
    window.__stream = stream;
    var track = stream.getAudioTracks()[0];
    var s = {};
    try { s = track.getSettings() || {}; } catch (e) { s = {}; }
    say('gum OK tracks=' + stream.getAudioTracks().length +
        ' state=' + (track && track.readyState) +
        ' label=' + (track && track.label) +
        ' settings=' + JSON.stringify(s));
    return 'live';
  }).catch(function (e) { return 'ERR ' + (e && e.name) + ':' + (e && e.message); });
}

// ---------------------------------------------------------------- A2: rec ---
function probeRecorder() {
  if (!window.__stream) { return Promise.resolve('no-stream'); }
  if (typeof MediaRecorder === 'undefined') { return Promise.resolve('no-MediaRecorder'); }
  return new Promise(function (resolve) {
    var chunks = [];
    var rec;
    try {
      rec = new MediaRecorder(window.__stream);
    } catch (e) { resolve('ctor-ERR ' + e.name); return; }
    rec.ondataavailable = function (e) { if (e.data && e.data.size) { chunks.push(e.data); } };
    rec.onstop = function () {
      var total = chunks.reduce(function (a, b) { return a + b.size; }, 0);
      say('recorded chunks=' + chunks.length + ' bytes=' + total +
          ' type=' + (chunks[0] && chunks[0].type));
      resolve(total > 0 ? 'captured' : 'empty');
    };
    try {
      rec.start();
      setTimeout(function () { try { rec.stop(); } catch (e) { resolve('stop-ERR'); } }, 1500);
    } catch (e) { resolve('start-ERR ' + e.name); }
  });
}

// ------------------------------------------------------- E1: service worker ---
function probeServiceWorker() {
  if (!navigator.serviceWorker) { return Promise.resolve('no-serviceWorker'); }
  return race(navigator.serviceWorker.register('lab/sw.js', { scope: 'lab/' })
    .then(function (reg) {
      return navigator.serviceWorker.ready.then(function () {
        var states = [reg.active && reg.active.state, reg.installing && reg.installing.state,
                      reg.waiting && reg.waiting.state].filter(Boolean);
        say('sw registered scope=' + reg.scope +
            ' controlled=' + !!navigator.serviceWorker.controller +
            ' states=' + states.join(','));
        return 'registered';
      });
    }).catch(function (e) { return 'ERR ' + (e && e.name) + ':' + (e && e.message); }),
    8000, 'sw');
}

// ------------------------------------------------------------ F1: file:// ---
function probeFileAccess() {
  var results = [];

  // 1. XHR (fetch() failed earlier; XHR is a different code path)
  results.push(race(new Promise(function (resolve) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', 'file:///factory/serial.txt');
      x.onload = function () { resolve('xhr status=' + x.status + ' len=' + (x.responseText || '').length); };
      x.onerror = function () { resolve('xhr onerror status=' + x.status); };
      x.send();
    } catch (e) { resolve('xhr threw ' + e.name); }
  }), 4000, 'xhr'));

  // 2. <img> — a load event proves file:// is readable to the element
  results.push(race(new Promise(function (resolve) {
    var img = document.createElement('img');
    img.onload = function () { resolve('img loaded'); };
    img.onerror = function () { resolve('img error'); };
    img.src = 'file:///system/build.prop';
    document.body.appendChild(img);
  }), 4000, 'img'));

  // 3. <iframe> — a document load would let us at least confirm readability
  results.push(race(new Promise(function (resolve) {
    var f = document.createElement('iframe');
    f.onload = function () {
      var t = 'n/a';
      try { t = String(f.contentDocument && f.contentDocument.body && f.contentDocument.body.textContent).slice(0, 40); }
      catch (e) { t = 'cross-origin'; }
      resolve('iframe loaded text=' + t);
    };
    f.onerror = function () { resolve('iframe error'); };
    f.src = 'file:///factory/serial.txt';
    document.body.appendChild(f);
  }), 4000, 'iframe'));

  return Promise.all(results).then(function (r) { return r.join(' ; '); });
}

// ------------------------------------------------------------------- run ---
say('begin ua-is-cast=' + (navigator.userAgent.indexOf('CrKey') !== -1));
probeDevices()
  .then(function (r) { say('A1-enumerate ' + r); return probeGetUserMedia(); })
  .then(function (r) { say('A1-gum ' + r); return probeRecorder(); })
  .then(function (r) { say('A2-recorder ' + r); return probeServiceWorker(); })
  .then(function (r) { say('E1-sw ' + r); return probeFileAccess(); })
  .then(function (r) { say('F1-file ' + r); })
  .catch(function (e) { say('fatal ' + (e && e.name) + ':' + (e && e.message)); })
  .then(function () { say('done'); });
