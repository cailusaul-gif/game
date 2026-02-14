(() => {
  const CG = (window.CoopGame = window.CoopGame || {});

  function circleRectOverlap(cx, cy, cr, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < cr * cr;
  }

  function circleCollidesWithMap(map, x, y, radius) {
    if (x - radius < 0 || y - radius < 0 || x + radius > map.widthPx || y + radius > map.heightPx) {
      return true;
    }

    const minTx = Math.floor((x - radius) / map.tileSize);
    const maxTx = Math.floor((x + radius) / map.tileSize);
    const minTy = Math.floor((y - radius) / map.tileSize);
    const maxTy = Math.floor((y + radius) / map.tileSize);

    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        if (!CG.MapSystem.isWall(map, tx, ty)) continue;

        const rx = tx * map.tileSize;
        const ry = ty * map.tileSize;
        if (circleRectOverlap(x, y, radius, rx, ry, map.tileSize, map.tileSize)) {
          return true;
        }
      }
    }

    return false;
  }

  function moveCircleWithMapCollision(map, entity, dx, dy) {
    let x = entity.x;
    let y = entity.y;

    const nextX = x + dx;
    if (!circleCollidesWithMap(map, nextX, y, entity.radius)) {
      x = nextX;
    }

    const nextY = y + dy;
    if (!circleCollidesWithMap(map, x, nextY, entity.radius)) {
      y = nextY;
    }

    return { x, y };
  }

  CG.Collision = {
    circleCollidesWithMap,
    moveCircleWithMapCollision,
  };
})();
