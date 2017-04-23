'use strict';

const assert = require('assert');

function join32(msg) {
  const len = msg.length;
  assert(len % 4 === 0);
  const res = new Array(len >>> 2);
  for (var i = 0, k = 0; i < res.length; i++, k += 4) {
    var w;
    w = (msg[k + 3] << 24) | (msg[k + 2] << 16) | (msg[k + 1] << 8) | msg[k];
    res[i] = w >>> 0;
  }
  return res;
}
exports.join32 = join32;

function split32(msg) {
  const res = new Uint8Array(msg.length << 2);
  for (var i = 0, k = 0; i < msg.length; i++, k += 4) {
    var m = msg[i];
    res[k + 3] = m >>> 24;
    res[k + 2] = (m >>> 16) & 0xff;
    res[k + 1] = (m >>> 8) & 0xff;
    res[k] = m & 0xff;
  }
  return res;
}
exports.split32 = split32;
