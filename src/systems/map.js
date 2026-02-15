(() => {
  const CG = (window.CoopGame = window.CoopGame || {});
  const { TILE_SIZE, MAP_COLS, MAP_ROWS } = CG.CONSTANTS;
  const { randInt } = CG.Utils;

  const WALL = 1;
  const FLOOR = 0;

  const STYLE_KEYS = ["forest", "swamp", "ruins"];
  const STYLE_PALETTE = {
    forest: {
      floor: ["#3f5f3f", "#4a6d49", "#567857"],
      wall: ["#4f5d43", "#58684d", "#47563f"],
      accents: ["#7fba78", "#93cf87", "#a7c98a"],
    },
    swamp: {
      floor: ["#3b5551", "#45645f", "#35504c"],
      wall: ["#53645a", "#4a5a52", "#3c4943"],
      accents: ["#86caa6", "#66b996", "#9cdab6"],
    },
    ruins: {
      floor: ["#56534f", "#625f59", "#6c6861"],
      wall: ["#716a63", "#665f58", "#57514a"],
      accents: ["#b7c2a6", "#c8d1b9", "#9ea98f"],
    },
    citadel: {
      floor: ["#4e4554", "#5a5062", "#433c49"],
      wall: ["#665b72", "#5d5368", "#4e4657"],
      accents: ["#d6a8f2", "#e6bfe9", "#9cc8e6"],
    },
  };

  const OBJECT_POOLS = {
    forest: {
      small: [
        "assets/objects/forest/white_red_mushroom1.png",
        "assets/objects/forest/chanterelles1.png",
        "assets/objects/forest/beige_green_mushroom1.png",
      ],
      medium: [
        "assets/objects/forest/curved_tree1.png",
        "assets/objects/forest/swirling_tree1.png",
        "assets/objects/forest/willow1.png",
      ],
      large: [
        "assets/objects/forest/mega_tree1.png",
        "assets/objects/forest/mega_tree2.png",
        "assets/objects/forest/living_gazebo1.png",
      ],
    },
    swamp: {
      small: [
        "assets/objects/forest/blue_green_balls_tree3.png",
        "assets/objects/forest/chanterelles2.png",
        "assets/objects/forest/beige_green_mushroom2.png",
      ],
      medium: [
        "assets/objects/forest/luminous_tree2.png",
        "assets/objects/forest/willow2.png",
        "assets/objects/forest/blue_green_balls_tree1.png",
      ],
      large: [
        "assets/objects/forest/ent_man.png",
        "assets/objects/forest/luminous_tree1.png",
        "assets/objects/forest/tree_idol_deer.png",
      ],
    },
    ruins: {
      small: [
        "assets/objects/forest/tree_idol_human.png",
        "assets/objects/forest/tree_idol_wolf.png",
        "assets/objects/forest/tree_idol_deer.png",
      ],
      medium: [
        "assets/objects/forest/white_tree1.png",
        "assets/objects/forest/white_tree2.png",
        "assets/objects/forest/tree_idol_human.png",
      ],
      large: [
        "assets/objects/forest/tree_idol_dragon.png",
        "assets/objects/forest/tree_idol_wolf.png",
        "assets/objects/forest/tree_idol_human.png",
      ],
    },
    citadel: {
      small: [
        "assets/objects/forest/blue_green_balls_tree2.png",
        "assets/objects/forest/white_red_mushroom3.png",
        "assets/objects/forest/beige_green_mushroom2.png",
      ],
      medium: [
        "assets/objects/forest/white_tree2.png",
        "assets/objects/forest/luminous_tree3.png",
        "assets/objects/forest/swirling_tree3.png",
      ],
      large: [
        "assets/objects/forest/tree_idol_dragon.png",
        "assets/objects/forest/ent_woman.png",
        "assets/objects/forest/luminous_tree4.png",
      ],
    },
  };

  function pick(arr) {
    return arr[randInt(0, arr.length)];
  }

  function createEmptyMap() {
    const tiles = [];
    for (let y = 0; y < MAP_ROWS; y += 1) {
      const row = [];
      for (let x = 0; x < MAP_COLS; x += 1) {
        row.push(FLOOR);
      }
      tiles.push(row);
    }
    return tiles;
  }

  function carveMainPath(tiles) {
    const midStart = Math.floor(MAP_COLS / 2) - 2;
    const midEnd = midStart + 4;
    for (let y = 0; y < MAP_ROWS; y += 1) {
      for (let x = midStart; x <= midEnd; x += 1) {
        tiles[y][x] = FLOOR;
      }
    }
  }

  function fillBorders(tiles) {
    for (let x = 0; x < MAP_COLS; x += 1) {
      tiles[0][x] = WALL;
      tiles[MAP_ROWS - 1][x] = WALL;
    }
    for (let y = 0; y < MAP_ROWS; y += 1) {
      tiles[y][0] = WALL;
      tiles[y][MAP_COLS - 1] = WALL;
    }
  }

  function carvePortalGate(tiles) {
    const portalW = 4;
    const start = Math.floor(MAP_COLS / 2 - portalW / 2);
    for (let x = start; x < start + portalW; x += 1) {
      tiles[0][x] = FLOOR;
      tiles[1][x] = FLOOR;
    }
  }

  function placeRectObstacle(tiles, rects, x, y, w, h) {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) {
        if (yy > 0 && yy < MAP_ROWS - 1 && xx > 0 && xx < MAP_COLS - 1) {
          tiles[yy][xx] = WALL;
        }
      }
    }
    rects.push({ x, y, w, h });
  }

  function canPlaceObstacle(tiles, x, y, w, h) {
    const spawnBandTop = MAP_ROWS - 4;
    const pathStart = Math.floor(MAP_COLS / 2) - 3;
    const pathEnd = pathStart + 6;

    if (y + h >= spawnBandTop) return false;

    for (let yy = y - 1; yy <= y + h; yy += 1) {
      for (let xx = x - 1; xx <= x + w; xx += 1) {
        if (yy < 1 || yy >= MAP_ROWS - 1 || xx < 1 || xx >= MAP_COLS - 1) return false;
        if (xx >= pathStart && xx <= pathEnd) return false;
        if (tiles[yy][xx] === WALL) return false;
      }
    }

    return true;
  }

  function addRandomObstacles(tiles, isBossRoom) {
    const rects = [];

    if (isBossRoom) {
      const cx = Math.floor(MAP_COLS / 2);
      const cy = Math.floor(MAP_ROWS / 2);
      placeRectObstacle(tiles, rects, cx - 6, cy - 4, 2, 2);
      placeRectObstacle(tiles, rects, cx + 4, cy - 4, 2, 2);
      placeRectObstacle(tiles, rects, cx - 6, cy + 2, 2, 2);
      placeRectObstacle(tiles, rects, cx + 4, cy + 2, 2, 2);
      placeRectObstacle(tiles, rects, cx - 1, cy - 1, 2, 2);
      return rects;
    }

    const count = randInt(5, 11);
    let tries = 0;
    let placed = 0;

    while (placed < count && tries < count * 15) {
      tries += 1;
      const w = randInt(2, 5);
      const h = randInt(2, 4);
      const x = randInt(2, MAP_COLS - w - 2);
      const y = randInt(2, MAP_ROWS - h - 2);
      if (!canPlaceObstacle(tiles, x, y, w, h)) continue;
      placeRectObstacle(tiles, rects, x, y, w, h);
      placed += 1;
    }

    return rects;
  }

  function makeObstacleProps(rects, style) {
    const pool = OBJECT_POOLS[style] || OBJECT_POOLS.forest;

    return rects.map((r) => {
      const area = r.w * r.h;
      const spritePath = area >= 8 ? pick(pool.large) : area >= 4 ? pick(pool.medium) : pick(pool.small);

      const collider = {
        x: r.x * TILE_SIZE,
        y: r.y * TILE_SIZE,
        w: r.w * TILE_SIZE,
        h: r.h * TILE_SIZE,
      };

      const baseW = collider.w;
      const baseH = collider.h;
      const scale = area >= 8 ? 2.1 : area >= 4 ? 1.85 : 1.55;
      const w = Math.max(baseW * scale, area >= 8 ? 170 : 110);
      const h = Math.max(baseH * scale, area >= 8 ? 170 : 110);

      const x = collider.x + collider.w * 0.5 - w * 0.5 + randInt(-6, 7);
      const y = collider.y + collider.h - h + randInt(-5, 6);

      return {
        path: spritePath,
        x,
        y,
        w,
        h,
        depthY: collider.y + collider.h,
        collider,
      };
    });
  }

  function makeObstacleMask(rects) {
    const mask = [];
    for (let y = 0; y < MAP_ROWS; y += 1) {
      const row = [];
      for (let x = 0; x < MAP_COLS; x += 1) row.push(false);
      mask.push(row);
    }

    for (const r of rects) {
      for (let yy = r.y; yy < r.y + r.h; yy += 1) {
        for (let xx = r.x; xx < r.x + r.w; xx += 1) {
          if (yy < 0 || yy >= MAP_ROWS || xx < 0 || xx >= MAP_COLS) continue;
          mask[yy][xx] = true;
        }
      }
    }

    return mask;
  }

  function makeDecor(tiles, styleKey, portalRect) {
    const decors = [];
    const count = styleKey === "citadel" ? randInt(12, 18) : randInt(18, 30);

    for (let i = 0; i < count; i += 1) {
      const tx = randInt(1, MAP_COLS - 1);
      const ty = randInt(1, MAP_ROWS - 1);
      if (tiles[ty][tx] === WALL) continue;

      const x = tx * TILE_SIZE + TILE_SIZE / 2;
      const y = ty * TILE_SIZE + TILE_SIZE / 2;
      if (
        x > portalRect.x - 60 &&
        x < portalRect.x + portalRect.w + 60 &&
        y < portalRect.y + portalRect.h + 80
      ) {
        continue;
      }

      let kind = "grass";
      if (styleKey === "forest") {
        kind = ["bush", "grass", "stone", "flower"][randInt(0, 4)];
      } else if (styleKey === "swamp") {
        kind = ["reed", "puddle", "stone", "moss"][randInt(0, 4)];
      } else if (styleKey === "ruins") {
        kind = ["rock", "pillar", "grass", "crack"][randInt(0, 4)];
      } else {
        kind = ["rune", "crystal", "stone", "crack"][randInt(0, 4)];
      }

      decors.push({
        kind,
        x,
        y,
        size: randInt(5, 14),
      });
    }

    return decors;
  }

  function createRoomMap(isBossRoom, styleKey) {
    const style = isBossRoom ? "citadel" : styleKey || STYLE_KEYS[randInt(0, STYLE_KEYS.length)];

    const tiles = createEmptyMap();
    carveMainPath(tiles);
    fillBorders(tiles);
    carvePortalGate(tiles);
    const obstacleRects = addRandomObstacles(tiles, isBossRoom);
    carveMainPath(tiles);

    const portalW = 4 * TILE_SIZE;
    const portalX = (MAP_COLS * TILE_SIZE - portalW) / 2;
    const portal = { x: portalX, y: 4, w: portalW, h: TILE_SIZE + 8 };

    return {
      tiles,
      style,
      palette: STYLE_PALETTE[style],
      obstacleRects,
      obstacleMask: makeObstacleMask(obstacleRects),
      obstacleProps: makeObstacleProps(obstacleRects, style),
      decorations: makeDecor(tiles, style, portal),
      tileSize: TILE_SIZE,
      cols: MAP_COLS,
      rows: MAP_ROWS,
      widthPx: MAP_COLS * TILE_SIZE,
      heightPx: MAP_ROWS * TILE_SIZE,
      spawnPoints: [
        { x: MAP_COLS * TILE_SIZE * 0.44, y: MAP_ROWS * TILE_SIZE - 60 },
        { x: MAP_COLS * TILE_SIZE * 0.56, y: MAP_ROWS * TILE_SIZE - 60 },
      ],
      portal,
    };
  }

  function isWall(map, tx, ty) {
    if (tx < 0 || tx >= map.cols || ty < 0 || ty >= map.rows) return true;
    return map.tiles[ty][tx] === WALL;
  }

  function getRandomOpenPosition(map, radius) {
    for (let i = 0; i < 120; i += 1) {
      const tx = randInt(2, map.cols - 2);
      const ty = randInt(2, map.rows - 5);
      if (isWall(map, tx, ty)) continue;

      const x = tx * map.tileSize + map.tileSize / 2;
      const y = ty * map.tileSize + map.tileSize / 2;

      if (
        x > map.portal.x - 80 &&
        x < map.portal.x + map.portal.w + 80 &&
        y < map.portal.y + map.portal.h + 90
      ) {
        continue;
      }

      if (CG.Collision.circleCollidesWithMap(map, x, y, radius)) continue;
      return { x, y };
    }

    return { x: map.widthPx * 0.5, y: map.heightPx * 0.5 };
  }

  CG.MapSystem = {
    WALL,
    FLOOR,
    STYLE_KEYS,
    STYLE_PALETTE,
    OBJECT_POOLS,
    createRoomMap,
    isWall,
    getRandomOpenPosition,
  };
})();
