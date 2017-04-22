'use strict';

const assert = require('assert');

const BadaBloom = require('../');

describe('BadaBloom', () => {
  let b;

  function B(str) {
    return Buffer.from(str);
  }

  beforeEach(() => {
    b = new BadaBloom();
  });

  it('should `.query()` missing items', () => {
    const other = new BadaBloom();

    for (let i = 0; i < 750; i++)
      b.insert(B(i.toString()));

    const bulk = [];
    for (let i = 250; i < 1000; i++)
      bulk.push(B(i.toString()));
    assert.equal(other.bulkInsert(bulk), bulk.length);

    const self = b.query(b.getRawFilter());
    assert.equal(self.length, 0);

    const missing = b.query(other.getRawFilter());
    assert.equal(missing.length, 250);
  });

  it('should `.fetch()` duplicates', () => {
    b.insert(B('hello'));
    b.insert(B('hello'));
    b.insert(B('ohai'));

    assert.deepEqual(b.entries, [ B('hello'), B('ohai') ]);
  });

  it('should `.has()` duplicates', () => {
    b.insert(B('hello'));
    b.insert(B('hello'));

    assert(b.has(B('hello')));
    assert(!b.has(B('ohai')));
  });
});
