'use strict';

const Bloom = require('../').Bloom;

const b = new Bloom(64 * 1024, 30);

const key = 'hello';

const COUNT = 1e6;

{
  const start = process.hrtime();
  for (var i = 0; i < COUNT; i++)
    b.add(key);
  const delta = process.hrtime(start);

  const sec = delta[0] + delta[1] / 1e9;
  console.log('add per sec: %d', (COUNT / sec).toFixed(2));
}

{
  const start = process.hrtime();
  for (var i = 0; i < COUNT; i++)
    b.test(key);
  const delta = process.hrtime(start);

  const sec = delta[0] + delta[1] / 1e9;
  console.log('test per sec: %d', (COUNT / sec).toFixed(2));
}
