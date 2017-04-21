'use strict';

const assert = require('assert');

const BadaBloom = require('../');

describe('BadaBloom', () => {
  let b;

  beforeEach(() => {
    b = new BadaBloom();
  });

  it('should `.insert()` and `.fetch()` should return value', () => {
    b.insert(Buffer.from('hello'), 'world');

    const r = b.fetch(Buffer.from('hello'));
    assert.deepEqual(r, [ 'world' ]);
  });

  it('should `.query()` missing items', () => {
    const other = new BadaBloom();

    for (let i = 0; i < 750; i++)
      b.insert(Buffer.from(i.toString()), i);
    for (let i = 250; i < 1000; i++)
      other.insert(Buffer.from(i.toString()), i);

    const self = b.query(b.getRawFilter());
    assert.equal(self.length, 0);

    const missing = b.query(other.getRawFilter());
    assert.equal(missing.length, 250);
  });

  it('shoud `.fetch()` duplicates', () => {
    b.insert(Buffer.from('hello'), 'world');
    b.insert(Buffer.from('hello'), 'everyone');
    b.insert(Buffer.from('ohai'), 'friends');

    const results = b.fetch(Buffer.from('hello'));
    assert.deepEqual(results, [ 'world', 'everyone' ]);
  });
});
