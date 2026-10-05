export const PRESETS = Object.freeze({
  high: Object.freeze({ pixelRatio: 2, shadows: true, soft: true, shadowMapSize: 2048, roomLights: true }),
  medium: Object.freeze({ pixelRatio: 1.5, shadows: true, soft: false, shadowMapSize: 1024, roomLights: true }),
  low: Object.freeze({ pixelRatio: 1, shadows: false, soft: false, shadowMapSize: 512, roomLights: false }),
});
const ORDER = ['high', 'medium', 'low'];

export function createQuality(setting, { budgetMs = 34, window = 30 } = {}) {
  const auto = setting === 'auto';
  let level = auto ? 'high' : setting;
  let samples = [];
  const median = () => {
    if (!samples.length) return 0;
    const s = [...samples].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  return {
    get level() { return level; },
    get preset() { return PRESETS[level]; },
    get median() { return median(); },
    sample(ms) {
      if (!auto || !(ms > 0) || !Number.isFinite(ms)) return null;
      samples.push(ms);
      if (samples.length > window) samples.shift();
      if (samples.length < window || median() <= budgetMs) return null;
      const next = ORDER[ORDER.indexOf(level) + 1];
      if (!next) return null;
      level = next;
      samples = [];
      return level;
    },
  };
}
