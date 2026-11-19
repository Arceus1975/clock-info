// Force a MAJOR collection, then use it.
//
// Previous attempts allocated and hoped; the WeakRef oracle showed nothing was
// ever collected, so those rounds proved nothing. Here the on-heap space is
// exhausted until allocation fails, which by definition requires a full
// collection to recover — and the WeakRef vouches for whether that happened
// before the 37975 check is believed.
var print = (typeof print === 'function') ? print : function () { };

// Keep everything alive until the failure, so the heap really is exhausted.
function exhaustHeap() {
  var keep = [];
  var objects = 0;
  try {
    while (objects < 4000000) {
      var block = new Array(1000);
      for (var i = 0; i < 1000; i++) { block[i] = { i: i, pad: 'xxxxxxxx' }; }
      keep.push(block);
      objects += 1000;
    }
  } catch (e) { /* expected: out of heap */ }
  keep = null;
  return objects;
}

function later(fn) { return new Promise(function (res) { setTimeout(function () { fn(); res(); }, 0); }); }

// ---- 1. does exhausting the heap actually collect anything? -----------------
var target = { probe: true };
var ref = new WeakRef(target);
target = null;

var collected = 'unknown';
later(function () {}).then(function () {
  // control point: before exhaustion
  print('[+]before-exhaust ' + (ref.deref() === undefined ? 'collected' : 'alive'));
  var n = exhaustHeap();
  print('[+]exhausted objects=' + n);
  return later(function () {
    collected = ref.deref() === undefined ? 'collected' : 'alive';
    print('[+]after-exhaust ' + collected);
  });
}).then(function () {
  // ---- 2. the 37975 check, now with a collection known to have happened ----
  var initKey = { init: 1 };
  var level = 4;
  var hits = 0, trials = 0;

  function hideWeakMap(map, level, initKey) {
    let prevMap = map, prevKey = initKey;
    for (let i = 0; i < level; i++) {
      let thisMap = new WeakMap();
      prevMap.set(prevKey, thisMap);
      let thisKey = { 'h': i };
      thisMap.set(prevKey, thisKey);
      prevMap = thisMap; prevKey = thisKey;
      if (i == level - 1) { let retMap = new WeakMap(); map.set(thisKey, retMap); return thisKey; }
    }
  }
  function getHiddenKey(map, level, initKey) {
    let prevMap = map, prevKey = initKey;
    for (let i = 0; i < level; i++) {
      let thisMap = prevMap.get(prevKey);
      let thisKey = thisMap.get(prevKey);
      prevMap = thisMap; prevKey = thisKey;
      if (i == level - 1) { return thisKey; }
    }
  }
  function setUpWeakMap(map) {
    let hk = hideWeakMap(map, level, initKey);
    let hiddenMap = map.get(hk);
    let map7 = new WeakMap(), map8 = new WeakMap(), map5 = new WeakMap();
    let k5 = { k5: 1 }, k7 = { k7: 1 }, k9 = { k9: 1 }, k8 = { k8: 1 }, v9 = {};
    map.set(k7, map7); map.set(k9, v9);
    hiddenMap.set(k5, map5); hiddenMap.set(hk, k5); map5.set(hk, k7);
    map7.set(k8, map8); map7.set(k7, k8); map8.set(k8, k9);
  }

  for (var r = 0; r < 6; r++) {
    try {
      var map1 = new WeakMap();
      setUpWeakMap(map1);
      exhaustHeap();
      let hiddenKey = getHiddenKey(map1, level, initKey);
      let hiddenMap = map1.get(hiddenKey);
      let k7 = hiddenMap.get(hiddenMap.get(hiddenKey)).get(hiddenKey);
      let k8 = map1.get(k7).get(k7);
      let map8 = map1.get(k7).get(k8);
      var observed = map1.get(map8.get(k8));
      trials++;
      if (observed === undefined) { hits++; }
    } catch (e) { print('[+]round ' + r + ' threw ' + e.name); }
  }
  print('[+]major37975 trials=' + trials + ' freed=' + hits +
        ' verdict=' + (hits > 0 ? 'FIRES' : 'no-fire') +
        ' oracle=' + collected);
  print('[+]major-gc-done');
});
