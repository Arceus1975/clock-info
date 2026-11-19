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
  // Large on-heap strings: one 1 MB string per entry fills the heap far faster
  // than many small objects, so a refusal is reachable in seconds.
  var keep = [];
  var objects = 0;
  var blocks = 0;
  var failure = 'cap';
  var unit = new Array(1024 * 1024).join('x');   // ~1 MB, built once
  try {
    while (blocks < 4000) {
      keep.push(unit + blocks);                    // unique cons string, kept alive
      objects += 1;
      blocks++;
      if (blocks % 50 === 0) { say('progress MB=' + blocks); }
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
