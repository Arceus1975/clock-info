// Validates the GC oracle before any more 37975 rounds.
//
// The question is not "does 37975 fire" but "does this renderer collect at all
// under JS-driven pressure". A WeakRef answers that directly: create an object,
// hold only a WeakRef to it, apply pressure, then ask if it is gone.
//
// If deref() never returns undefined, the GC is not collecting under our stimulus
// and every previous "37975 does not fire" result is uninformative.
var print = (typeof print === 'function') ? print : function () { };

function onHeapPressure(blocks, perBlock) {
  var keep = [];
  for (var i = 0; i < blocks; i++) {
    var block = new Array(perBlock);
    for (var j = 0; j < perBlock; j++) { block[j] = { i: i, j: j, s: 'pad' + j }; }
    keep.push(block);
  }
  return keep.length;
}

function externalPressure(chunks, size) {
  var held = [];
  var made = 0;
  try {
    for (var i = 0; i < chunks; i++) { held.push(new ArrayBuffer(size)); made++; }
  } catch (e) { /* allocation failure is fine, that is the point */ }
  return made;
}

print('[+]weakref-support ' + (typeof WeakRef));

// WeakRef keeps its target alive for the CURRENT JOB, so deref() must be taken
// in a later task. Checking synchronously always reports 'alive' — an earlier
// revision did exactly that.
function probe(label, pressureFn) {
  return new Promise(function (resolve) {
    var target = { alive: label };
    var ref = new WeakRef(target);
    target = null;
    pressureFn();
    setTimeout(function () {
      var state = ref.deref() === undefined ? 'collected' : 'alive';
      print('[+]probe ' + label + ' => ' + state);
      resolve();
    }, 0);
  });
}

// Sequential, each awaiting a task boundary before the deref.
Promise.resolve()
  .then(function () { return probe('no-pressure', function () { }); })
  .then(function () { return probe('onheap-200k', function () { onHeapPressure(400, 500); }); })
  .then(function () { return probe('onheap-600k', function () { onHeapPressure(1200, 500); }); })
  .then(function () { return probe('external-128MB', function () { externalPressure(2, 0x04000000); }); })
  .then(function () { return probe('churn-1m', function () {
      for (var i = 0; i < 1000000; i++) { var t = { a: i }; }
    }); })
  .then(function () { print('[+]gc-oracle-done'); });
