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

  this.entries = [];
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
  for (let i = 0; i < this.entries.length; i++)
    this.filter.add(this.entries[i].key);

  return true;
};

BadaBloom.prototype.getFilterOptions = function getFilterOptions() {
  return Bloom.optimalParams(this.entries.length,
                             this.options.probability);
};

BadaBloom.prototype.fetch = function fetch(key) {
  this._recompute();
  if (!this.filter.test(key))
    return false;

  // No false-positives are allowed
  // TODO(indutny): binary search
  for (let i = 0; i < this.entries.length; i++)
    if (this.entries[i].key.equals(key))
      return this.entries[i].value;
  return false;
};

BadaBloom.prototype.insert = function insert(key, value) {
  // TODO(indutny): sort
  this.entries.push({ key, value });
  if (!this._recompute())
    this.filter.add(key);
};

BadaBloom.prototype.getCount = function getCount() {
  return this.entries.length;
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

  return this.entries.filter((entry) => {
    return !filter.test(entry.key);
  });
};
