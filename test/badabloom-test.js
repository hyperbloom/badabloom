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

  it('should `.sync()` missing items', () => {
    const other = new BadaBloom();

    for (let i = 0; i < 750; i++)
      b.insert(B(i.toString()));

    const bulk = [];
    for (let i = 250; i < 1000; i++)
      bulk.push(B(i.toString()));
    assert.equal(other.bulkInsert(bulk), bulk.length);

    const self = b.sync(b.getRawFilter());
    assert.equal(self.length, 0);

    const missing = b.sync(other.getRawFilter());
    assert.equal(missing.length, 250);
  });

  it('should support `.sync()` limit', () => {
    const other = new BadaBloom();

    for (let i = 0; i < 750; i++)
      b.insert(B(i.toString()));

    const bulk = [];
    for (let i = 250; i < 1000; i++)
      bulk.push(B(i.toString()));
    assert.equal(other.bulkInsert(bulk), bulk.length);

    const self = b.sync(b.getRawFilter(), 10);
    assert.equal(self.length, 0);

    const missing = b.sync(other.getRawFilter(), 10);
    assert.equal(missing.length, 10);

    const empty = b.sync(other.getRawFilter(), 0);
    assert.equal(empty.length, 0);
  });

  it('should ignore duplicates', () => {
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

  it('should throw on empty values', () => {
    assert.throws(() => {
      b.insert(B(''));
    });
    assert(!b.has(B('')));
  });

  it('should sort entries', () => {
    const list = [ 'a', 'x', 'wy', 's', 'w', 'y', 'z', 'b', 'ab', 'wz', 'wyz' ];

    list.forEach(elem => b.insert(B(elem)));

    assert.deepEqual(b.entries, list.slice().sort().map(B));
  });

  it('should `.request()` entries', () => {
    const list = [ 'a', 'x', 'wy', 's', 'w', 'y', 'z', 'b', 'ab', 'wz', 'wyz' ];

    list.forEach(elem => b.insert(B(elem)));

    assert.deepEqual(b.request(B('a'), B('c')), [ 'a', 'ab', 'b' ].map(B));
    assert.deepEqual(b.request(B('a'), B('b')), [ 'a', 'ab' ].map(B));
    assert.deepEqual(b.request(B('a'), B('b'), 1), [ 'a' ].map(B));
    assert.deepEqual(b.request(B('a'), B('b'), 0), [ ].map(B));

    assert.deepEqual(b.request(B('s'), B('wz')),
                     [ 's', 'w', 'wy', 'wyz' ].map(B));
  });
});
