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

  it('should `.insert()` and `.fetch()` should return value', () => {
    b.insert(B('hello'), B('world'));

    const r = b.fetch(B('hello'));
    assert.deepEqual(r, [ B('world') ]);
  });

  it('should `.bulkInsert()`', () => {
    b.bulkInsert([ { key: B('hello'), value: B('world') },
                   { key: B('ohai'), value: B('everyone') } ]);

    const r = b.fetch(B('hello'));
    assert.deepEqual(r, [ B('world') ]);
  });

  it('should `.query()` missing items', () => {
    const other = new BadaBloom();

    for (let i = 0; i < 750; i++)
      b.insert(B((i >>> 1).toString()), B(i.toString()));
    for (let i = 250; i < 1000; i++)
      other.insert(B((i >>> 1).toString()), B(i.toString()));

    const self = b.query(b.getRawFilter());
    assert.equal(self.length, 0);

    const missing = b.query(other.getRawFilter());
    assert.equal(missing.length, 250);
  });

  it('should `.fetch()` duplicates', () => {
    b.insert(B('hello'), B('world'));
    b.insert(B('hello'), B('everyone'));
    b.insert(B('ohai'), B('friends'));

    const results = b.fetch(B('hello'));
    assert.deepEqual(results, [ B('world'), B('everyone') ]);
  });

  it('should `.has()` duplicates', () => {
    b.insert(B('hello'), B('world'));
    b.insert(B('hello'), B('everyone'));

    assert(b.has(B('hello'), B('world')));
    assert(b.has(B('hello'), B('everyone')));
    assert(!b.has(B('hello'), B('someone')));
    assert(!b.has(B('ohai'), B('someone')));
  });
});
