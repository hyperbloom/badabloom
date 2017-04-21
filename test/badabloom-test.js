'use strict';

const assert = require('assert');

const BadaBloom = require('../');

describe('BadaBloom', () => {
  let b;

  beforeEach(() => {
    b = new BadaBloom();
  });

  it('should `.insert()` and `.fetch()` should return value', () => {
    b.insert('hello', 'world');

    const r = b.fetch('hello');
    assert.deepEqual(r, [ 'world' ]);
  });

  it('should `.query()` missing items', () => {
    const other = new BadaBloom();

    for (let i = 0; i < 750; i++)
      b.insert(i.toString(), i);
    for (let i = 250; i < 1000; i++)
      other.insert(i.toString(), i);

    const self = b.query(b.getRawFilter());
    assert.equal(self.length, 0);

    const missing = b.query(other.getRawFilter());
    assert.equal(missing.length, 250);
  });

  it('shoud `.fetch()` duplicates', () => {
    b.insert('hello', 'world');
    b.insert('hello', 'everyone');
    b.insert('ohai', 'friends');

    const results = b.fetch('hello');
    assert.deepEqual(results, [ 'world', 'everyone' ]);
  });

  it('shoud `.has()` duplicates', () => {
    b.insert('hello', 'world');
    b.insert('hello', 'everyone');

    assert(b.has('hello', 'world'));
    assert(b.has('hello', 'everyone'));
    assert(!b.has('hello', 'someone'));
    assert(!b.has('ohai', 'someone'));
  });
});
