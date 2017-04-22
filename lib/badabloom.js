'use strict';

const assert = require('assert');

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

BadaBloom.prototype.has = function has(value) {
  // TODO(indutny): binary search
  return this.entries.some((entry) => {
    return entry.equals(value);
  });
};

BadaBloom.prototype.bulkInsert = function bulkInsert(values) {
  // TODO(indutny): check if recompute will be needed ahead of time?
  this._recompute();

  const count = this.count;
  values.forEach((value) => {
    if (this.has(value))
      return;

    // TODO(indutny): binary insert
    this.entries.push(value);
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

BadaBloom.prototype.query = function query(raw) {
  const size = Bloom.size(raw.filter);

  // Should be validated by caller, but just in case
  if (size < raw.size)
    return [];

  const filter = new Bloom(raw.size, raw.n, raw.tweak, raw.filter);

  const res = [];
  this.entries.forEach((value) => {
    if (!filter.test(value))
      res.push(value);
  });
  return res;
};
