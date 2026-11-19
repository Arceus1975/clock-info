// Phase 1, attempt 2: cheaper pressure + V8 idle collection.
//
// The previous attempt reloaded mid-allocation, so it never finished. Two changes:
//   * smaller blocks (1.6 MB) so a pass completes in seconds, and
//   * after allocating, YIELD repeatedly - V8 runs a full collection at idle,
//     which needs no allocation failure at all.
// Heap telemetry (performance.memory) shows whether the heap moved.
var print = (typeof print === 'function') ? print : function () { };
function say(s) { print('[gcidle] ' + s); }
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

function fill(blocks, perBlock) {
  var keep = [];
  for (var b = 0; b < blocks; b++) {
    var a = new Array(perBlock);
    a.fill(1.1);
    keep.push(a);
  }
  return keep.length;
}

say('begin ref=' + (ref.deref() === undefined ? 'collected' : 'alive') + ' ' + heap());

var started = Date.now();
var n = fill(120, 200000);
say('filled blocks=' + n + ' in ' + (Date.now() - started) + 'ms ' + heap());

var turns = 0;
function step() {
  turns++;
  var state = ref.deref() === undefined ? 'collected' : 'alive';
  if (turns % 5 === 1 || state === 'collected') {
    say('turn ' + turns + ' ref=' + state + ' ' + heap());
  }
  if (state === 'collected') { say('RESULT collected at turn ' + turns); return; }
  if (turns >= 30) { say('RESULT still-alive after ' + turns + ' turns ' + heap()); return; }
  setTimeout(step, 100);
}
setTimeout(step, 50);
