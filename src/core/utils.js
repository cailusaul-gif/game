(() => {
  const CG = (window.CoopGame = window.CoopGame || {});

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function randInt(min, maxExclusive) {
    return Math.floor(min + Math.random() * (maxExclusive - min));
  }

  function randFloat(min, max) {
    return min + Math.random() * (max - min);
  }

  function normalize(x, y) {
    const len = Math.hypot(x, y);
    if (len < 0.0001) return null;
    return { x: x / len, y: y / len };
  }

  function nearestAlivePlayer(entity, players) {
    let best = null;
    let bestDist = Infinity;

    for (const p of players) {
      if (!p.alive) continue;
      const d = Math.hypot(entity.x - p.x, entity.y - p.y);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    }

    return best;
  }

  function rectContainsCircle(rect, x, y, r) {
    return x - r >= rect.x && x + r <= rect.x + rect.w && y - r >= rect.y && y + r <= rect.y + rect.h;
  }

  CG.Utils = {
    clamp,
    randInt,
    randFloat,
    normalize,
    nearestAlivePlayer,
    rectContainsCircle,
  };
})();
