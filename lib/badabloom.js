'use strict';

const assert = require('assert');
const binarySearch = require('binary-search');

const Bloom = require('./bloom');

const DEFAULT_PROBABILITY = 1e-9;
const DEFAULT_OVERHEAD = 2;
const DEFAULT_MIN_SIZE = 2048;

function BadaBloom(options) {
  this.options = Object.assign({
    probability: DEFAULT_PROBABILITY,
    overhead: DEFAULT_OVERHEAD,
    minSize: DEFAULT_MIN_SIZE
  }, options);

  this.filter = null;
  this.entries = [];
  this.count = 0;
}
module.exports = BadaBloom;

// Mostly for testing
BadaBloom.Bloom = Bloom;

BadaBloom.prototype._recompute = function _recompute() {
  const filter = this.filter;
  const params = this.getFilterOptions();

  // Recompute only if our filter can't handle it
  if (filter && params.n <= filter.n && params.size <= filter.size)
    return false;

  // Add some extra overhead to our filter to avoid recomputing it too often
  params.size = Math.ceil(params.size * this.options.overhead);
  params.size = Math.max(this.options.minSize, params.size);

  this.filter = new Bloom(params.size, params.n,
                          (Math.random() * 0xffffffff) >>> 0);
  this.entries.forEach((entry) => {
    this.filter.add(entry);
  });

  return true;
};

BadaBloom.prototype.getFilterOptions = function getFilterOptions() {
  return Bloom.optimalParams(this.count, this.options.probability);
};

function compareEntries(a, b) {
  var min = Math.min(a.length, b.length);
  for (var i = 0; i < min; i++) {
    if (a[i] < b[i])
      return -1;
    else if (a[i] > b[i])
      return 1;
  }
  if (a.length === b.length)
    return 0;
  else if (a.length === min)
    return -1;
  else
    return 1;
}

BadaBloom.prototype.has = function has(value) {
  const index = binarySearch(this.entries, value, compareEntries);
  return index >= 0;
};

BadaBloom.prototype.bulkInsert = function bulkInsert(values) {
  // TODO(indutny): check if recompute will be needed ahead of time?
  this._recompute();

  const count = this.count;
  values.forEach((value) => {
    assert(value.length > 0, 'value MUST not be empty');

    const index = binarySearch(this.entries, value, compareEntries);

    // Already present
    if (index >= 0)
      return;

    this.entries.splice(-1 - index, 0, value);
    this.filter.add(value);
    this.count++;
  });

  if (count === this.count)
    return 0;

  this._recompute();
  return this.count - count;
};

BadaBloom.prototype.insert = function insert(value) {
  return this.bulkInsert([ value ]) !== 0;
};

BadaBloom.prototype.getCount = function getCount() {
  return this.count;
};

BadaBloom.prototype.getRawFilter = function getRawFilter() {
  return {
    filter: this.filter.filter.slice(),
    size: this.filter.size,
    n: this.filter.n,
    tweak: this.filter.tweak
  };
};

BadaBloom.prototype.sync = function sync(raw, limit) {
  if (limit === 0)
    return [];

  const size = Bloom.size(raw.filter);

  // Should be validated by caller, but just in case
  if (size < raw.size)
    return [];

  const filter = new Bloom(raw.size, raw.n, raw.tweak, raw.filter);

  const res = [];
  this.entries.every((value) => {
    if (!filter.test(value))
      res.push(value);
    return !limit || res.length < limit;
  });
  return res;
};

BadaBloom.prototype.request = function request(start, end, limit) {
  // Invalid request
  if (compareEntries(start, end) >= 0)
    return [];

  if (limit === 0)
    return [];

  const res = [];

  let startI = binarySearch(this.entries, start, compareEntries);
  let endI = binarySearch(this.entries, end, compareEntries);

  if (startI < 0)
    startI = -1 - startI;
  if (endI < 0)
    endI = -1 - endI;

  if (limit)
    endI = Math.min(limit, endI - startI) + startI;

  return this.entries.slice(startI, endI);
};
