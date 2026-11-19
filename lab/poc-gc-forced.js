// Phase 1 / G1: force a major collection, or prove it cannot be forced.
//
// Previous attempts were capped and V8 simply grew the heap. This allocates
// on-heap objects until the allocator REFUSES, then reads a WeakRef in a later
// task. If the target is still alive after a refusal, this renderer does not
// collect under JS-driven pressure and the GC-dependent CVE is unreachable.
var print = (typeof print === 'function') ? print : function () { };
function say(s) { print('[gcforced] ' + s); }

var target = { probe: true };
var ref = new WeakRef(target);
target = null;

function allocateUntilRefused() {
  var keep = [];
  var objects = 0;
  var blocks = 0;
  var failure = 'cap';
  try {
    while (blocks < 20000) {
      var block = new Array(5000);
      for (var i = 0; i < 5000; i++) { block[i] = { i: i, s: 'pad' + i }; }
      keep.push(block);
      objects += 5000;
      blocks++;
      if (blocks % 200 === 0) { say('progress objects=' + objects); }
    }
  } catch (e) { failure = e.name; }
  // keep is released here; the collection (if any) happens while it is still held
  say('allocated objects=' + objects + ' failure=' + failure);
  keep = null;
  return objects;
}

say('begin heap-intact="' + (ref.deref() === undefined ? 'collected' : 'alive') + '"');
allocateUntilRefused();

setTimeout(function () {
  say('after alloc ref=' + (ref.deref() === undefined ? 'collected' : 'alive'));
  // second chance: a further burst after a task boundary
  var junk = [];
  try { for (var i = 0; i < 400000; i++) { junk.push({ x: i }); } } catch (e) { }
  junk = null;
  setTimeout(function () {
    say('after burst ref=' + (ref.deref() === undefined ? 'collected' : 'alive'));
    say('done');
  }, 0);
}, 0);
