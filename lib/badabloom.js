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
  this.entries.forEach((list) => {
    list.forEach(({ binary }) => {
      this.filter.add(binary);
    });
  });

  return true;
};

BadaBloom.prototype.getFilterOptions = function getFilterOptions() {
  return Bloom.optimalParams(this.count, this.options.probability);
};

BadaBloom.prototype.fetch = function fetch(key) {
  // No false-positives are allowed
  return (this.entries.get(key.toString('hex')) || []).map(({ value }) => value);
};

BadaBloom.prototype.has = function has(key, value) {
  return this.fetch(key).some((entry) => {
    return entry.equals(value);
  });
};

BadaBloom.prototype.bulkInsert = function bulkInsert(pairs) {
  // TODO(indutny): check if recompute will be needed ahead of time?
  this._recompute();

  const count = this.count;
  pairs.forEach(({ key, value }) => {
    assert(0 < key.length < 256, 'key must have length between 0 and 256');
    assert(0 < value.length < 256, 'value must have length between 0 and 256');

    if (this.has(key, value))
      return;

    const hexKey = key.toString('hex');

    let list;
    if (this.entries.has(hexKey)) {
      list = this.entries.get(hexKey);
    } else {
      list = [];
      this.entries.set(hexKey, list);
    }

    const binary = Buffer.alloc(2 + key.length + value.length);
    binary[0] = key.length;
    key.copy(binary, 1);
    binary[key.length + 1] = value.length;
    value.copy(binary, key.length + 2);

    list.push({ binary, value });
    this.filter.add(binary);
    this.count++;
  });

  if (count === this.count)
    return 0;

  this._recompute();
  return this.count - count;
};

BadaBloom.prototype.insert = function insert(key, value) {
  return this.bulkInsert([ { key, value } ]) !== 0;
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
  this.entries.forEach((list, key) => {
    list.forEach(({ binary, value }) => {
      if (!filter.test(binary))
        res.push({ key, value });
    });
  });
  return res;
};
