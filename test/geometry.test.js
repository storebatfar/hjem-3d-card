import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wallPieces, wallBoxes, openingParts, roofGeometry, panelRects } from '../src/geometry.js';

const area = ps => ps.reduce((s, p) => s + (p.b - p.a) * (p.y1 - p.y0), 0);
const win = { from: 2, to: 3, sill: 0.9, head: 2.1, kind: 'window' };
const door = { from: 5, to: 6, sill: 0, head: 2.1, kind: 'door' };

test('a wall without openings is one piece', () => {
  assert.deepEqual(wallPieces([], 10, 2.5), [{ a: 0, b: 10, y0: 0, y1: 2.5, kind: 'wall' }]);
});

test('a window splits the wall into before, sill, head, pane, after', () => {
  const ps = wallPieces([win], 10, 2.5);
  assert.equal(ps.length, 5);
  assert.deepEqual(ps.filter(p => p.kind === 'window'), [{ a: 2, b: 3, y0: 0.9, y1: 2.1, kind: 'window' }]);
});

test('a door has no sill piece; a full-height opening has no head piece', () => {
  assert.equal(wallPieces([door], 10, 2.5).length, 4);
  assert.equal(wallPieces([{ ...door, head: 2.5 }], 10, 2.5).length, 3);
});

test('pieces tile the whole wall exactly', () => {
  const ps = wallPieces([win, door], 10, 2.5);
  assert.ok(Math.abs(area(ps) - 25) < 1e-9);
});

test('wallBoxes places each side on the right face', () => {
  const shell = { width: 12, depth: 8, wallHeight: 2.5, wallThickness: 0.4 };
  const n = wallBoxes('north', shell, []);
  assert.deepEqual([n[0].z0, n[0].z1, n[0].x0, n[0].x1], [0, 0.4, 0, 12]);
  const e = wallBoxes('east', shell, []);
  assert.deepEqual([e[0].x0, e[0].x1], [11.6, 12]);
  const w = wallBoxes('west', shell, [{ from: 2, to: 4.4, sill: 0, head: 2.15, kind: 'garage-door' }]);
  assert.equal(Math.min(...w.map(b => b.z0)), 0.4);
  assert.equal(Math.max(...w.map(b => b.z1)), 7.6);
  assert.ok(w.some(b => b.kind === 'garage-door' && b.z0 === 2 && b.z1 === 4.4));
});

test('openingParts centres the pane in the wall and frames it', () => {
  const box = { x0: 2, x1: 3, y0: 0.9, y1: 2.1, z0: 0, z1: 0.4, kind: 'window', side: 'north' };
  const { pane, frame } = openingParts(box);
  assert.ok(Math.abs((pane.z0 + pane.z1) / 2 - 0.2) < 1e-9);
  assert.equal(frame.length, 4);
  assert.equal(openingParts({ ...box, kind: 'door' }).frame.length, 3);
  const side = openingParts({ x0: 0, x1: 0.4, y0: 0, y1: 2, z0: 2, z1: 4, kind: 'garage-door', side: 'west' });
  assert.ok(Math.abs((side.pane.x0 + side.pane.x1) / 2 - 0.2) < 1e-9);
  assert.deepEqual([side.pane.z0, side.pane.z1], [2, 4]);
});

test('roofGeometry follows the pitch', () => {
  const r = roofGeometry({ width: 12, depth: 8, wallHeight: 2.5 }, { pitch: 45, overhang: 0.4, gableOverhang: 0.2 });
  assert.ok(Math.abs(r.rise - 4) < 1e-9);
  assert.ok(Math.abs(r.ridgeY - 6.5) < 1e-9);
  assert.ok(Math.abs(r.slopeLength - 4.4 / Math.cos(Math.PI / 4)) < 1e-9);
  assert.equal(r.width, 12.4);
});

test('panelRects makes cols × rows panels inside the field', () => {
  const ps = panelRects([{ x0: 2, x1: 6, from: 1, to: 3, cols: 4, rows: 2 }]);
  assert.equal(ps.length, 8);
  for (const p of ps) assert.ok(p.x0 >= 2 && p.x1 <= 6 && p.from >= 1 && p.to <= 3 && p.x1 > p.x0);
});
