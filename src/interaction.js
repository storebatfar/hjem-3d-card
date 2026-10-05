const MAX_DT = 100;

export function createInteraction({ idleTimeoutMs, transitionMs = 1600, now = 0 }) {
  let mode = 'idle';
  let t = 0;
  let lastTick = now;
  let lastInput = now;

  const animating = () => mode === 'opening' || mode === 'closing';
  const snapshot = () => ({ mode, t, animating: animating() });

  function tap(at, hit) {
    const wasAnimating = animating();
    lastInput = at;
    if (mode === 'idle' || mode === 'closing') mode = 'opening';
    else if (hit === 'empty') mode = 'closing';
    if (!wasAnimating && animating()) lastTick = at;
    return snapshot();
  }

  function tick(at) {
    const dt = Math.min(Math.max(0, at - lastTick), MAX_DT);
    lastTick = at;
    if (mode === 'opening') {
      t = Math.min(1, t + dt / transitionMs);
      if (t === 1) mode = 'plan';
    } else if (mode === 'closing') {
      t = Math.max(0, t - dt / transitionMs);
      if (t === 0) mode = 'idle';
    } else if (mode === 'plan' && at - lastInput >= idleTimeoutMs) {
      mode = 'closing';
    }
    return snapshot();
  }

  // Test and screenshot hook: put the view at a fixed t without animating.
  function jump(value, at) {
    t = Math.min(1, Math.max(0, value));
    mode = t === 1 ? 'plan' : 'idle';
    lastTick = lastInput = at;
    return { mode, t, animating: false };
  }

  return { tap, tick, jump, snapshot, get mode() { return mode; } };
}
