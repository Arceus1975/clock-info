// Phase 1, attempt 3: allocate in small steps, yielding to the event loop.
//
// Every earlier attempt did its allocation synchronously and the receiver was
// restarted mid-pass: blocking the event loop starves the Cast heartbeat, which
// looks like a hung app. Small chunks with a yield between them keep it alive.
var print = (typeof print === 'function') ? print : function () { };
function say(s) { print('[gcyield] ' + s); }
function heap() {
  try {
    var m = performance.memory;
    if (!m) { return 'n/a'; }
    return 'used=' + Math.round(m.usedJSHeapSize / 1048576) +
           'MB total=' + Math.round(m.totalJSHeapSize / 1048576) + 'MB';
  } catch (e) { return 'n/a'; }
}

var target = { probe: true };
var ref = new WeakRef(target);
target = null;

var keep = [];
var step = 0;
var STEPS = 60;          // 60 x 8 MB = 480 MB target
var PER = 500000;        // 4 MB per chunk (doubles)

say('begin ref=' + (ref.deref() === undefined ? 'collected' : 'alive') + ' ' + heap());

function tick() {
  step++;
  try {
    var a = new Array(PER);
    a.fill(1.1);
    keep.push(a);
  } catch (e) { say('alloc-failed step=' + step + ' ' + e.name); }

  if (step % 10 === 0) { say('step ' + step + ' ' + heap()); }

  if (step < STEPS) { setTimeout(tick, 30); return; }

  say('allocated steps=' + STEPS + ' ' + heap());
  setTimeout(check, 100);
}

var checks = 0;
function check() {
  checks++;
  var state = ref.deref() === undefined ? 'collected' : 'alive';
  if (checks % 5 === 1 || state === 'collected') {
    say('check ' + checks + ' ref=' + state + ' ' + heap());
  }
  if (state === 'collected') { say('RESULT collected'); return; }
  if (checks >= 25) {
    // Last resort: drop everything and ask again after the heap can shrink.
    keep = null;
    setTimeout(function () {
      say('RESULT after-drop ref=' +
          (ref.deref() === undefined ? 'collected' : 'alive') + ' ' + heap());
    }, 300);
    return;
  }
  setTimeout(check, 120);
}

setTimeout(tick, 20);
