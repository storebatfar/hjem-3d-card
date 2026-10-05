import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validateHouse } from '../src/config.js';

const file = new URL('../harness/private/house.json', import.meta.url);

test('private house description validates', { skip: !existsSync(file) && 'no harness/private/house.json' }, () => {
  const h = validateHouse(JSON.parse(readFileSync(file)));
  assert.equal(h.openings.west.length, 2);
  assert.ok(h.shell.width > h.shell.depth);
});
