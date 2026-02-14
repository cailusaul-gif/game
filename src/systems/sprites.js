(() => {
  const CG = (window.CoopGame = window.CoopGame || {});

  const imageCache = new Map();

  function pad(n) {
    return String(n).padStart(3, "0");
  }

  function makeFrames(base, count) {
    const frames = [];
    for (let i = 0; i < count; i += 1) {
      frames.push(`${base}/${pad(i)}.png`);
    }
    return frames;
  }

  const profiles = {
    player: {
      samurai: {
        idle: makeFrames("assets/sprites/players/samurai/idle", 18),
        run: makeFrames("assets/sprites/players/samurai/run", 12),
        attack: makeFrames("assets/sprites/players/samurai/attack", 12),
        hurt: makeFrames("assets/sprites/players/samurai/hurt", 12),
      },
      archer: {
        idle: makeFrames("assets/sprites/players/archer/idle", 18),
        run: makeFrames("assets/sprites/players/archer/run", 12),
        attack: makeFrames("assets/sprites/players/archer/attack", 9),
        hurt: makeFrames("assets/sprites/players/archer/hurt", 12),
      },
      mage: {
        idle: makeFrames("assets/sprites/players/mage/idle", 18),
        run: makeFrames("assets/sprites/players/mage/run", 12),
        attack: makeFrames("assets/sprites/players/mage/attack", 9),
        hurt: makeFrames("assets/sprites/players/mage/hurt", 12),
      },
    },
    enemy: {
      goblin: {
        idle: makeFrames("assets/sprites/enemies/goblin/idle", 18),
        run: makeFrames("assets/sprites/enemies/goblin/run", 12),
        attack: makeFrames("assets/sprites/enemies/goblin/attack", 12),
        hurt: makeFrames("assets/sprites/enemies/goblin/hurt", 12),
      },
      orc: {
        idle: makeFrames("assets/sprites/enemies/orc/idle", 18),
        run: makeFrames("assets/sprites/enemies/orc/run", 12),
        attack: makeFrames("assets/sprites/enemies/orc/attack", 12),
        hurt: makeFrames("assets/sprites/enemies/orc/hurt", 12),
      },
      ogre: {
        idle: makeFrames("assets/sprites/enemies/ogre/idle", 18),
        run: makeFrames("assets/sprites/enemies/ogre/run", 12),
        attack: makeFrames("assets/sprites/enemies/ogre/attack", 12),
        hurt: makeFrames("assets/sprites/enemies/ogre/hurt", 12),
      },
    },
  };

  function resolveProfile(entity) {
    if (entity.classKey) {
      return profiles.player[entity.classKey] || null;
    }

    if (entity.type === "boss") return profiles.enemy.ogre;
    if (entity.type === "grunt") return profiles.enemy.goblin;
    if (entity.type === "shooter") return profiles.enemy.orc;
    if (entity.type === "tank") return profiles.enemy.ogre;
    return null;
  }

  function getImage(path) {
    let img = imageCache.get(path);
    if (!img) {
      img = new Image();
      img.src = path;
      imageCache.set(path, img);
    }
    return img;
  }

  function getState(entity) {
    if (entity.spriteAttackTimer > 0) return "attack";
    if (entity.spriteHurtTimer > 0) return "hurt";
    if (entity.spriteMoving) return "run";
    return "idle";
  }

  function getFrameIndex(entity, frames, state) {
    const len = frames.length;
    if (len <= 1) return 0;

    if (state === "attack") {
      const total = Math.max(0.01, entity.spriteAttackDuration || 0.2);
      const t = 1 - Math.max(0, entity.spriteAttackTimer) / total;
      return Math.min(len - 1, Math.floor(t * len));
    }

    if (state === "hurt") {
      const total = Math.max(0.01, entity.spriteHurtDuration || 0.2);
      const t = 1 - Math.max(0, entity.spriteHurtTimer) / total;
      return Math.min(len - 1, Math.floor(t * len));
    }

    const now = performance.now() * 0.001;
    const fps = state === "run" ? 14 : 8;
    const seed = entity.spriteSeed || 0;
    return Math.floor((now + seed) * fps) % len;
  }

  function drawEntity(ctx, entity, options) {
    const opts = options || {};
    const profile = resolveProfile(entity);
    if (!profile) return false;

    const state = getState(entity);
    const frames = profile[state] || profile.idle;
    const idx = getFrameIndex(entity, frames, state);
    const img = getImage(frames[idx]);

    if (!img.complete || img.naturalWidth <= 0) return false;

    const scale = entity.spriteScale || 0.09;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const facing = entity.spriteFacing && entity.spriteFacing < 0 ? -1 : 1;
    const yOffset = entity.spriteYOffset || 0;

    ctx.save();
    ctx.translate(entity.x, entity.y + yOffset);
    if (facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -w * 0.5, -h * 0.56, w, h);
    ctx.restore();

    return true;
  }

  function prime() {
    for (const family of Object.values(profiles)) {
      for (const set of Object.values(family)) {
        for (const seq of Object.values(set)) {
          for (const frame of seq) getImage(frame);
        }
      }
    }
  }

  CG.SpriteSystem = {
    drawEntity,
    prime,
    getImage,
  };
})();
