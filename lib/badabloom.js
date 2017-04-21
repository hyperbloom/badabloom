'use strict';

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

  this.entries = new Map();
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
  this.entries.forEach((_, key) => {
    this.filter.add(key);
  });

  return true;
};

BadaBloom.prototype.getFilterOptions = function getFilterOptions() {
  return Bloom.optimalParams(this.count, this.options.probability);
};

BadaBloom.prototype.fetch = function fetch(key) {
  this._recompute();
  if (!this.filter.test(key))
    return [];

  // No false-positives are allowed
  return this.entries.get(key) || [];
};

BadaBloom.prototype.has = function has(key, value) {
  return this.fetch(key).some((entry) => {
    return entry === value;
  });
};

BadaBloom.prototype.insert = function insert(key, value) {
  let list;
  if (this.entries.has(key)) {
    list = this.entries.get(key);
  } else {
    list = [];
    this.entries.set(key, list);
  }

  if (list.includes(value))
    return false;

  list.push(value);
  this.count++;

  if (!this._recompute())
    this.filter.add(key);
  return true;
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

  let res = [];
  this.entries.forEach((value, key) => {
    if (!filter.test(key))
      res = res.concat(value);
  });
  return res;
};
