// Why did the Service Worker registration not resolve? Report the state and the
// actual rejection reason rather than a bare timeout.
var print = (typeof print === 'function') ? print : function () { };
var T = '[phase0] ';
function say(s) { print(T + s); }

say('sw-begin secure=' + window.isSecureContext +
    ' hasSW=' + (typeof navigator.serviceWorker) +
    ' hasContainer=' + !!(navigator.serviceWorker && navigator.serviceWorker.container));

try {
  var p = navigator.serviceWorker.register('lab/sw.js', { scope: 'lab/' });
  p.then(function (reg) {
    say('sw-resolved scope=' + reg.scope +
        ' active=' + (reg.active && reg.active.state) +
        ' installing=' + (reg.installing && reg.installing.state) +
        ' waiting=' + (reg.waiting && reg.waiting.state));
  }).catch(function (e) {
    say('sw-rejected ' + (e && e.name) + ':' + (e && e.message));
  });
} catch (e) {
  say('sw-threw ' + e.name + ':' + e.message);
}

// A second, independent signal: ready resolves only when one is active.
setTimeout(function () {
  say('sw-ready-check');
  navigator.serviceWorker.ready.then(function (reg) {
    say('sw-ready scope=' + reg.scope + ' active=' + (reg.active && reg.active.state));
  }).catch(function (e) { say('sw-ready-rejected ' + (e && e.name)); });
}, 3000);
setTimeout(function () { say('sw-done'); }, 12000);
