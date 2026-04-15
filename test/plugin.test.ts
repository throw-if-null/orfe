import assert from 'node:assert/strict';
import test from 'node:test';

import OrfePlugin, { OrfePlugin as NamedOrfePlugin } from '../src/plugin.js';

test('plugin entry points export a plugin function', () => {
  assert.equal(typeof OrfePlugin, 'function');
  assert.equal(typeof NamedOrfePlugin, 'function');
});
