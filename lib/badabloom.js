'use strict';

const assert = require('assert');
const binarySearch = require('binary-search');
const Buffer = require('buffer').Buffer;

const utils = require('./utils');
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

function compare(a, b) {
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
BadaBloom.compare = compare;

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

BadaBloom.prototype.has = function has(value) {
  const index = binarySearch(this.entries, value, compare);
  return index >= 0;
};

BadaBloom.prototype.bulkInsert = function bulkInsert(values) {
  // Create bloom filter if it is not present
  this._recompute();

  const res = [];
  values.forEach((value) => {
    assert(value.length > 0, 'value MUST not be empty');

    const index = binarySearch(this.entries, value, compare);

    // Already present
    if (index >= 0)
      return;

    this.entries.splice(-1 - index, 0, value);
    this.filter.add(value);
    this.count++;
    res.push(value);
  });

  if (res.length !== 0)
    this._recompute();

  return res;
};

BadaBloom.prototype.insert = function insert(value) {
  return this.bulkInsert([ value ]).length !== 0;
};

BadaBloom.prototype.getRawFilter = function getRawFilter() {
  this._recompute();
  return {
    filter: utils.split32(this.filter.filter),
    size: this.filter.size,
    n: this.filter.n,
    seed: this.filter.seed
  };
};

BadaBloom.prototype._range = function range(range) {
  let startI = binarySearch(this.entries, range.start, compare);
  let endI = range.end ? binarySearch(this.entries, range.end, compare) :
             this.entries.length;
  if (startI < 0)
    startI = -1 - startI;
  if (endI < 0)
    endI = -1 - endI;

  return { start: startI, end: endI };
};

BadaBloom.prototype.sync = function sync(raw, range, limit) {
  if (typeof range === 'number') {
    limit = range;
    range = undefined;
  }

  if (!limit)
    limit = Number.MAX_SAFE_INTEGER;

  const size = Bloom.size(raw.filter);

  // Should be validated by caller, but just in case
  if (size < raw.size)
    return [];

  // Pad `bytes` if needed
  let bytes = raw.filter;
  if (bytes.length % 4 !== 0) {
    const copy = Buffer.alloc(bytes.length + (4 - (bytes.length % 4)));
    bytes.copy(copy);
    bytes = copy;
  }

  const filter = new Bloom(raw.size, raw.n, raw.seed, utils.join32(bytes));

  const res = [];

  let indexes;
  if (!range)
    indexes = { start: 0, end: this.entries.length };
  else
    indexes = this._range(range);
  for (var i = indexes.start; i < indexes.end && res.length < limit; i++)
    if (!filter.test(this.entries[i]))
      res.push(this.entries[i]);

  return res;
};

BadaBloom.prototype.request = function request(range, limit) {
  // Invalid request
  if (range.end && compare(range.start, range.end) >= 0)
    return [];

  const res = [];

  const indexes = this._range(range);

  if (limit)
    indexes.end = Math.min(limit, indexes.end - indexes.start) + indexes.start;

  return this.entries.slice(indexes.start, indexes.end);
};
