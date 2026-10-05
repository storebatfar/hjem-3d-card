const KINDS = ['window', 'door', 'garage-door'];
const SURFACES = ['concrete', 'path', 'deck'];
const QUALITIES = ['auto', 'high', 'medium', 'low'];
const SIDES = ['north', 'south', 'west', 'east'];

export const DEFAULTS = Object.freeze({
  idle_timeout: 60,
  height: 'calc(100vh - 96px)',
  quality: 'auto',
  north_offset: 0,
  debug: false,
});

const fail = (path, msg) => { throw new Error(`hjem-3d-card: ${path} ${msg}`); };
const num = (v, path) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, 'skal være et tal');
  return v;
};
const range = (o, a, b, path) => {
  num(o[a], `${path}.${a}`);
  num(o[b], `${path}.${b}`);
  if (!(o[b] > o[a])) fail(`${path}.${b}`, `skal være større end ${a}`);
};
const list = (v, path) => {
  if (v === undefined) return [];
  if (!Array.isArray(v)) fail(path, 'skal være en liste');
  return v;
};
const positive = (v, path) => { if (!(num(v, path) > 0)) fail(path, 'skal være større end 0'); return v; };

export function validateHouse(h) {
  if (!h || typeof h !== 'object') fail('house', 'mangler i kortets indstillinger');
  const plot = h.plot ?? fail('house.plot', 'mangler');
  range(plot, 'x0', 'x1', 'house.plot');
  range(plot, 'z0', 'z1', 'house.plot');

  const shell = { wallHeight: 2.5, wallThickness: 0.4, ...(h.shell ?? fail('house.shell', 'mangler')) };
  for (const k of ['width', 'depth', 'wallHeight', 'wallThickness']) positive(shell[k], `house.shell.${k}`);

  const r = h.roof ?? {};
  const roof = { pitch: 25, overhang: 0.35, gableOverhang: 0.2, ...r };
  num(roof.pitch, 'house.roof.pitch');
  if (roof.pitch <= 0 || roof.pitch >= 60) fail('house.roof.pitch', 'skal være mellem 0 og 60 grader');
  num(roof.overhang, 'house.roof.overhang');
  num(roof.gableOverhang, 'house.roof.gableOverhang');
  roof.solar = list(r.solar, 'house.roof.solar').map((p, i) => {
    const path = `house.roof.solar[${i}]`;
    if (!p || typeof p !== 'object') fail(path, 'skal være et objekt');
    range(p, 'x0', 'x1', path);
    range(p, 'from', 'to', path);
    const cols = p.cols ?? 1, rows = p.rows ?? 1;
    if (!Number.isInteger(cols) || cols < 1) fail(`${path}.cols`, 'skal være et helt tal ≥ 1');
    if (!Number.isInteger(rows) || rows < 1) fail(`${path}.rows`, 'skal være et helt tal ≥ 1');
    return { x0: p.x0, x1: p.x1, from: p.from, to: p.to, cols, rows };
  });
  roof.windows = list(r.windows, 'house.roof.windows').map((w, i) => {
    const path = `house.roof.windows[${i}]`;
    if (!w || typeof w !== 'object') fail(path, 'skal være et objekt');
    range(w, 'x0', 'x1', path);
    range(w, 'from', 'to', path);
    return { x0: w.x0, x1: w.x1, from: w.from, to: w.to };
  });

  const openings = {};
  for (const side of SIDES) {
    const len = side === 'north' || side === 'south' ? shell.width : shell.depth;
    const items = list(h.openings?.[side], `house.openings.${side}`).map((o, index) => {
      const path = `house.openings.${side}[${index}]`;
      if (!o || typeof o !== 'object') fail(path, 'skal være et objekt');
      if (!KINDS.includes(o.kind)) fail(`${path}.kind`, `skal være en af ${KINDS.join(', ')}`);
      range(o, 'from', 'to', path);
      const sill = o.sill ?? 0;
      num(sill, `${path}.sill`);
      if (sill < 0) fail(`${path}.sill`, 'må ikke være negativ');
      num(o.head, `${path}.head`);
      if (!(o.head > sill)) fail(`${path}.head`, 'skal være større end sill');
      if (o.from < 0 || o.to > len) fail(path, `ligger uden for væggen (0–${len})`);
      if (o.head > shell.wallHeight) fail(`${path}.head`, `er højere end væggen (${shell.wallHeight})`);
      return { from: o.from, to: o.to, sill, head: o.head, kind: o.kind, index };
    }).sort((a, b) => a.from - b.from);
    for (let i = 1; i < items.length; i++) {
      if (items[i].from < items[i - 1].to) {
        fail(`house.openings.${side}[${items[i].index}]`, `overlapper house.openings.${side}[${items[i - 1].index}]`);
      }
    }
    openings[side] = items.map(({ index, ...o }) => o);
  }

  const surfaces = list(h.surfaces, 'house.surfaces').map((s, i) => {
    const path = `house.surfaces[${i}]`;
    if (!s || typeof s !== 'object') fail(path, 'skal være et objekt');
    if (!SURFACES.includes(s.kind)) fail(`${path}.kind`, `skal være en af ${SURFACES.join(', ')}`);
    range(s, 'x0', 'x1', path);
    range(s, 'z0', 'z1', path);
    return { kind: s.kind, x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1 };
  });

  const hedges = list(h.hedges, 'house.hedges').map((g, i) => {
    const path = `house.hedges[${i}]`;
    if (!g || typeof g !== 'object') fail(path, 'skal være et objekt');
    range(g, 'x0', 'x1', path);
    range(g, 'z0', 'z1', path);
    return { x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1, h: positive(g.h ?? 1.6, `${path}.h`) };
  });

  return { plot: { x0: plot.x0, x1: plot.x1, z0: plot.z0, z1: plot.z1 }, shell, roof, openings, surfaces, hedges };
}

export function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('hjem-3d-card: ugyldig konfiguration');
  const cfg = { ...DEFAULTS, ...raw };
  if (!(num(cfg.idle_timeout, 'idle_timeout') >= 5)) fail('idle_timeout', 'skal være mindst 5 sekunder');
  if (!QUALITIES.includes(cfg.quality)) fail('quality', `skal være en af ${QUALITIES.join(', ')}`);
  num(cfg.north_offset, 'north_offset');
  if (typeof cfg.height !== 'string' || !cfg.height.trim()) fail('height', 'skal være en CSS-højde, fx "720px"');
  cfg.debug = cfg.debug === true;
  cfg.house = validateHouse(raw.house);
  return cfg;
}
