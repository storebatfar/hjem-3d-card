import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/version.js';

test('version is year.month.number and matches package.json', () => {
  assert.match(VERSION, /^\d{4}\.\d{1,2}\.\d+$/);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.version, VERSION);
});

test('built bundle registers the custom element', () => {
  const dist = readFileSync(new URL('../dist/hjem-3d-card.js', import.meta.url), 'utf8');
  assert.match(dist, /hjem-3d-card/);
});
