(() => {
  const CG = (window.CoopGame = window.CoopGame || {});
  const { ENEMY_DEFS } = CG.CONSTANTS;
  const { clamp, randInt, randFloat, normalize, nearestAlivePlayer } = CG.Utils;

  const ELITE_SKILLS = [
    { key: "berserk", name: "狂战", weight: 12 },
    { key: "bulwark", name: "铁壁", weight: 10 },
    { key: "vampiric", name: "嗜血", weight: 10 },
    { key: "splitter", name: "裂弹", weight: 9, rangedOnly: true },
    { key: "storm", name: "风暴弹幕", weight: 8 },
    { key: "blink", name: "相位突袭", weight: 8 },
    { key: "charge", name: "裂地冲锋", weight: 8, meleeOnly: true },
    { key: "summoner", name: "召唤统帅", weight: 7 },
    { key: "frost", name: "寒霜印记", weight: 8 },
    { key: "arcane", name: "奥术共鸣", weight: 8 },
    { key: "thorns", name: "荆棘甲", weight: 9 },
    { key: "executioner", name: "处刑者", weight: 8 },
    { key: "phoenix", name: "不灭", weight: 6 },
    { key: "colossus", name: "巨像", weight: 8 },
    { key: "drain", name: "汲魂光环", weight: 7 },
  ];

  function pickEliteSkill(used, ranged, fromSummon) {
    const pool = ELITE_SKILLS.filter((s) => {
      if (used.has(s.key)) return false;
      if (fromSummon && (s.key === "summoner" || s.key === "phoenix")) return false;
      if (s.rangedOnly && !ranged) return false;
      if (s.meleeOnly && ranged) return false;
      return true;
    });
    if (pool.length <= 0) return null;

    const total = pool.reduce((acc, s) => acc + s.weight, 0);
    let roll = Math.random() * total;
    for (const s of pool) {
      roll -= s.weight;
      if (roll <= 0) return s;
    }
    return pool[0];
  }

  function rotateDir(dir, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      x: dir.x * c - dir.y * s,
      y: dir.x * s + dir.y * c,
    };
  }

  class Enemy extends CG.Entity {
    constructor(type, x, y, scale, options) {
      const def = ENEMY_DEFS[type];
      const s = scale || 1;
      super(x, y, def.radius * s);
      const opts = options || {};

      this.type = type;
      this.def = def;
      this.maxHp = def.maxHp * s;
      this.hp = this.maxHp;
      this.speed = def.speed * (0.8 + Math.random() * 0.4);
      this.damage = def.damage * s;
      this.attackCooldown = def.attackCooldown;
      this.attackTimer = Math.random() * this.attackCooldown;
      this.rewarded = false;
      this.goldDrop = Math.floor(4 * s + Math.random() * 8 * s);
      this.xpDrop = Math.floor(7 * s + Math.random() * 10 * s);
      this.potionDropChance = 0.14;
      this.spriteMoving = false;
      this.spriteFacing = Math.random() > 0.5 ? 1 : -1;
      this.spriteAttackTimer = 0;
      this.spriteAttackDuration = 0.22;
      this.spriteHurtTimer = 0;
      this.spriteHurtDuration = 0.2;
      this.spriteScale = type === "tank" ? 0.094 : type === "shooter" ? 0.085 : 0.08;
      this.spriteYOffset = 8;
      this.spriteSeed = Math.random() * 10;

      this.damageReduction = 0;
      this.lifeSteal = 0;
      this.thorns = 0;
      this.projectileSpeedMul = 1;
      this.splitShots = 0;
      this.arcaneChance = 0;
      this.executeBonus = 0;
      this.hitSlow = null;
      this.reviveReady = false;

      this.tempSlowTimer = 0;
      this.tempSlowMul = 1;
      this.eliteSkills = [];
      this.eliteTimers = {};
      this.chargeTimer = 0;
      this.chargeCooldown = 0;
      this.chargeDir = { x: 1, y: 0 };
      this.chargeHitIds = new Set();
      this.summonedCount = 0;
      this.summonCap = opts.fromSummon ? 0 : opts.isBoss ? 6 : 2;
      this.turnBias = Math.random() < 0.5 ? -1 : 1;
      this.stuckTimer = 0;
      this.recoverPhase = Math.random() * Math.PI * 2;
      this.difficultyTier = Math.max(0, opts.difficultyTier || 0);
      this.enrageThreshold = 0;
      this.enrageDamageMul = 1;
      this.enrageSpeedMul = 1;
      this.isEnraged = false;
      this.deathBurst = null;
      this.volleyShots = 0;
      this.traitTags = [];

      this.rollEliteSkills(opts);
      this.applyTierProgression(opts);
    }

    rollEliteSkills(options) {
      if (options.skipElite) return;
      const isBoss = !!options.isBoss;
      const fromSummon = !!options.fromSummon;
      const ranged = !!this.def.ranged;
      const min = options.eliteMin ?? (isBoss ? 5 : fromSummon ? 1 : 2);
      const max = options.eliteMax ?? (isBoss ? 7 : fromSummon ? 2 : 4);
      const count = options.eliteCount ?? randInt(min, max + 1);

      const used = new Set();
      for (let i = 0; i < count; i += 1) {
        const picked = pickEliteSkill(used, ranged, fromSummon);
        if (!picked) break;
        used.add(picked.key);
        this.eliteSkills.push(picked);
        this.applyEliteSkill(picked.key, isBoss);
      }

      this.hp = this.maxHp;
    }

    applyTierProgression(options) {
      const opts = options || {};
      const tier = Math.max(0, this.difficultyTier);
      if (tier <= 0) return;

      if (opts.isBoss) {
        this.goldDrop = Math.floor(this.goldDrop * (1 + tier * 0.1));
        this.xpDrop = Math.floor(this.xpDrop * (1 + tier * 0.12));
        return;
      }

      const statMul = 1 + tier * 0.13;
      this.maxHp *= statMul;
      this.hp = this.maxHp;
      this.damage *= 1 + tier * 0.11;
      this.speed *= 1 + tier * 0.02;
      this.attackCooldown = Math.max(0.28, this.attackCooldown * (1 - Math.min(0.22, tier * 0.03)));
      this.goldDrop = Math.floor(this.goldDrop * (1 + tier * 0.08));
      this.xpDrop = Math.floor(this.xpDrop * (1 + tier * 0.1));

      if (!opts.isBoss && !opts.fromSummon) {
        if (Math.random() < Math.min(0.22 + tier * 0.04, 0.58)) {
          this.enrageThreshold = 0.45 - Math.min(0.18, tier * 0.03);
          this.enrageDamageMul = 1.18 + tier * 0.06;
          this.enrageSpeedMul = 1.12 + tier * 0.04;
          this.traitTags.push("狂怒");
        }

        if (Math.random() < Math.min(0.16 + tier * 0.03, 0.48)) {
          this.deathBurst = {
            radius: Math.floor(40 + tier * 10 + this.radius),
            damageMul: 0.45 + tier * 0.07,
          };
          this.traitTags.push("自爆");
        }

        if (this.def.ranged && Math.random() < Math.min(0.2 + tier * 0.03, 0.5)) {
          this.volleyShots = Math.min(4, 1 + Math.floor((tier + 1) / 2));
          this.traitTags.push("连射");
        }
      }
    }

    applyEliteSkill(skillKey, isBoss) {
      const bossMul = isBoss ? 1.22 : 1;
      if (skillKey === "berserk") {
        this.maxHp *= 1.2 * bossMul;
        this.damage *= 1.35 * bossMul;
        this.speed *= 1.14;
        this.attackCooldown *= 0.86;
        return;
      }
      if (skillKey === "bulwark") {
        this.maxHp *= 1.45 * bossMul;
        this.damageReduction = clamp(this.damageReduction + 0.2, 0, 0.6);
        this.speed *= 0.92;
        return;
      }
      if (skillKey === "vampiric") {
        this.lifeSteal += 0.22 * bossMul;
        this.damage *= 1.14;
        return;
      }
      if (skillKey === "splitter") {
        this.splitShots += 2;
        this.attackCooldown *= 0.92;
        this.projectileSpeedMul *= 1.08;
        return;
      }
      if (skillKey === "storm") {
        this.eliteTimers.storm = randFloat(1.8, 3.2);
        this.damage *= 1.07;
        return;
      }
      if (skillKey === "blink") {
        this.eliteTimers.blink = randFloat(2.5, 4.4);
        this.speed *= 1.08;
        return;
      }
      if (skillKey === "charge") {
        this.chargeCooldown = randFloat(1.8, 3.3);
        this.damage *= 1.12;
        return;
      }
      if (skillKey === "summoner") {
        this.eliteTimers.summon = randFloat(3.4, 6.2);
        this.maxHp *= 1.15;
        return;
      }
      if (skillKey === "frost") {
        this.hitSlow = { mul: 0.74, duration: 1.5 * bossMul };
        this.damage *= 1.06;
        return;
      }
      if (skillKey === "arcane") {
        this.arcaneChance += 0.2;
        this.damage *= 1.12;
        this.eliteTimers.arcane = randFloat(1.6, 3);
        return;
      }
      if (skillKey === "thorns") {
        this.thorns += 0.2;
        this.maxHp *= 1.12;
        return;
      }
      if (skillKey === "executioner") {
        this.executeBonus += 0.5;
        this.attackCooldown *= 0.9;
        return;
      }
      if (skillKey === "phoenix") {
        this.reviveReady = true;
        this.maxHp *= 1.12;
        return;
      }
      if (skillKey === "colossus") {
        this.radius *= 1.2;
        this.spriteScale *= 1.2;
        this.maxHp *= 1.55 * bossMul;
        this.damageReduction = clamp(this.damageReduction + 0.12, 0, 0.65);
        this.damage *= 1.2;
        this.speed *= 0.78;
        return;
      }
      if (skillKey === "drain") {
        this.eliteTimers.drain = randFloat(2.8, 4.5);
      }
    }

    applySlow(mul, duration) {
      this.tempSlowMul = Math.min(this.tempSlowMul, clamp(mul, 0.35, 1));
      this.tempSlowTimer = Math.max(this.tempSlowTimer, duration);
    }

    getMoveMul() {
      return this.tempSlowTimer > 0 ? this.tempSlowMul : 1;
    }

    isPathOpen(game, dir, distance) {
      if (!game || !game.currentMap || !dir) return false;
      const nx = this.x + dir.x * distance;
      const ny = this.y + dir.y * distance;
      return !CG.Collision.circleCollidesWithMap(game.currentMap, nx, ny, this.radius);
    }

    resolveInvalidPosition(game) {
      if (!game || !game.currentMap) return;
      if (!CG.Collision.circleCollidesWithMap(game.currentMap, this.x, this.y, this.radius)) return;

      const probeRadii = [this.radius * 1.2, this.radius * 1.9, this.radius * 2.8, this.radius * 4];
      const samples = 16;
      for (const radius of probeRadii) {
        for (let i = 0; i < samples; i += 1) {
          const a = this.recoverPhase + (Math.PI * 2 * i) / samples;
          const nx = this.x + Math.cos(a) * radius;
          const ny = this.y + Math.sin(a) * radius;
          if (!CG.Collision.circleCollidesWithMap(game.currentMap, nx, ny, this.radius)) {
            this.x = nx;
            this.y = ny;
            this.recoverPhase += 0.47;
            return;
          }
        }
      }

      const fallback = CG.MapSystem.getRandomOpenPosition(game.currentMap, this.radius + 2);
      this.x = fallback.x;
      this.y = fallback.y;
    }

    moveSmart(game, desiredDir, speed, dt, options) {
      if (!desiredDir || !game || !game.currentMap) return 0;
      const opts = options || {};
      const step = Math.max(0, speed * dt);
      if (step <= 0) return 0;

      const angles =
        this.turnBias > 0
          ? [0, 0.32, -0.32, 0.62, -0.62, 0.94, -0.94, 1.3, -1.3, Math.PI]
          : [0, -0.32, 0.32, -0.62, 0.62, -0.94, 0.94, -1.3, 1.3, Math.PI];
      const probe = Math.max(step * 1.3, this.radius * 0.82);
      const target = opts.target || null;

      let best = null;
      let bestScore = -Infinity;

      for (const offset of angles) {
        if (opts.disallowReverse && Math.abs(offset - Math.PI) < 1e-3) continue;
        const candidate = rotateDir(desiredDir, offset);
        if (!this.isPathOpen(game, candidate, probe)) continue;

        let score = candidate.x * desiredDir.x + candidate.y * desiredDir.y;
        if (target && opts.preferRetreat) {
          const now = Math.hypot(target.x - this.x, target.y - this.y);
          const next = Math.hypot(target.x - (this.x + candidate.x * probe), target.y - (this.y + candidate.y * probe));
          score += (next - now) * 0.03;
        }
        if (target && typeof opts.preferRange === "number") {
          const next = Math.hypot(target.x - (this.x + candidate.x * probe), target.y - (this.y + candidate.y * probe));
          score -= Math.abs(next - opts.preferRange) * 0.012;
        }

        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }

      if (!best) {
        const side = { x: -desiredDir.y * this.turnBias, y: desiredDir.x * this.turnBias };
        if (this.isPathOpen(game, side, Math.max(step, this.radius * 0.7))) {
          best = side;
        } else if (this.isPathOpen(game, desiredDir, Math.max(step, this.radius * 0.7))) {
          best = desiredDir;
        } else {
          best = { x: -side.x, y: -side.y };
        }
      }

      const ox = this.x;
      const oy = this.y;
      game.moveEntity(this, best.x * step, best.y * step);
      let moved = Math.hypot(this.x - ox, this.y - oy);

      const stuckLimit = Math.max(0.35, step * 0.08);
      if (moved <= stuckLimit) {
        this.stuckTimer += dt;
        if (this.stuckTimer >= 0.34) {
          this.turnBias *= -1;
          const panic = rotateDir(desiredDir, this.turnBias * Math.PI * 0.5);
          if (this.isPathOpen(game, panic, Math.max(step * 0.95, this.radius * 0.75))) {
            const px = this.x;
            const py = this.y;
            game.moveEntity(this, panic.x * step * 0.95, panic.y * step * 0.95);
            moved = Math.max(moved, Math.hypot(this.x - px, this.y - py));
          }
          this.stuckTimer = 0.12;
        }
      } else {
        this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2.6);
      }

      this.spriteMoving = this.spriteMoving || moved > 0.01;
      return moved;
    }

    takeDamage(amount, options) {
      if (!this.alive) return 0;
      const opts = options || {};
      const incoming = opts.ignoreReduction ? amount : amount * (1 - this.damageReduction);
      const damage = Math.max(1, incoming);
      const prevHp = this.hp;
      this.hp -= damage;
      this.spriteHurtTimer = this.spriteHurtDuration;

      const dealt = Math.max(0, prevHp - this.hp);
      if (dealt > 0 && this.thorns > 0 && opts.attacker && opts.attacker.alive) {
        opts.attacker.takeDamage(dealt * this.thorns, {
          ignoreDefense: true,
          sourceEnemy: this,
          game: opts.game,
          noProc: false,
        });
      }

      if (this.hp <= 0) {
        if (this.reviveReady) {
          this.reviveReady = false;
          this.hp = this.maxHp * 0.35;
          this.alive = true;
          if (opts.game) {
            opts.game.effects.push({
              kind: "revive",
              x: this.x,
              y: this.y,
              r: this.radius + 18,
              t: 0.25,
              color: "rgba(255,168,132,0.52)",
            });
          }
        } else {
          if (this.deathBurst && opts.game) {
            const burst = this.deathBurst;
            for (const p of opts.game.players) {
              if (!p.alive) continue;
              const d = Math.hypot(p.x - this.x, p.y - this.y);
              if (d > burst.radius + p.radius) continue;
              this.dealDamageToPlayer(p, this.damage * burst.damageMul, opts.game);
            }
            opts.game.effects.push({
              kind: "enemy_storm",
              x: this.x,
              y: this.y,
              r: burst.radius,
              t: 0.2,
              color: "rgba(255,136,120,0.45)",
            });
          }
          this.hp = 0;
          this.alive = false;
        }
      }

      return dealt;
    }

    dealDamageToPlayer(target, amount, game) {
      const dealt = target.takeDamage(amount, { sourceEnemy: this, game });
      if (dealt > 0 && this.lifeSteal > 0) {
        this.hp = clamp(this.hp + dealt * this.lifeSteal, 0, this.maxHp);
      }
      return dealt;
    }

    fireProjectile(game, dir, options) {
      const opts = options || {};
      const speed = (opts.speed || this.def.projectileSpeed || 220) * this.projectileSpeedMul;
      game.projectiles.push(
        new CG.Projectile(this.x, this.y, dir.x * speed, dir.y * speed, {
          owner: "enemy",
          damage: opts.damage || this.damage,
          radius: opts.radius || 5,
          ttl: opts.ttl || 2.3,
          color: opts.color || "#ffd166",
          sourceEnemy: this,
          onPlayerHit: opts.onPlayerHit || null,
          visual: opts.visual || "enemy_bolt",
          trailColor: opts.trailColor || "rgba(255,214,130,0.4)",
        })
      );
    }

    fireSpread(game, dir, count, arc, options) {
      if (!dir) return;
      const total = Math.max(1, count);
      const spreadArc = arc || 0.45;
      for (let i = 0; i < total; i += 1) {
        const t = total === 1 ? 0 : i / (total - 1);
        const delta = (t - 0.5) * spreadArc;
        const ca = Math.cos(delta);
        const sa = Math.sin(delta);
        const sx = dir.x * ca - dir.y * sa;
        const sy = dir.x * sa + dir.y * ca;
        this.fireProjectile(game, { x: sx, y: sy }, options);
      }
    }

    hasEliteSkill(key) {
      return this.eliteSkills.some((s) => s.key === key);
    }

    pickRangedShotProfile() {
      const profile = {
        color: "#ffd166",
        visual: "enemy_bolt",
        trailColor: "rgba(255,209,128,0.5)",
      };

      if (this.hasEliteSkill("storm")) {
        profile.color = "#ffac74";
        profile.visual = "enemy_burst";
        profile.trailColor = "rgba(255,170,120,0.56)";
      }
      if (this.hasEliteSkill("frost")) {
        profile.color = "#a7e7ff";
        profile.visual = "rune_disc";
        profile.trailColor = "rgba(161,230,255,0.55)";
      }
      if (this.hasEliteSkill("splitter")) {
        profile.color = "#ffcda1";
        profile.visual = "star_lance";
        profile.trailColor = "rgba(255,220,188,0.55)";
      }
      if (this.hasEliteSkill("arcane")) {
        profile.color = "#d9a7ff";
        profile.visual = "void_spike";
        profile.trailColor = "rgba(210,158,255,0.58)";
      }
      if (this.type === "boss" && this.hasEliteSkill("drain")) {
        profile.color = "#f6a2ff";
        profile.visual = "void_spike";
        profile.trailColor = "rgba(229,163,255,0.6)";
      }

      return profile;
    }

    updateEliteSkills(dt, game, target, dist, dx, dy) {
      const has = (key) => this.hasEliteSkill(key);
      for (const key of Object.keys(this.eliteTimers)) {
        this.eliteTimers[key] -= dt;
      }

      this.tempSlowTimer = Math.max(0, this.tempSlowTimer - dt);
      if (this.tempSlowTimer <= 0) this.tempSlowMul = 1;
      this.chargeCooldown = Math.max(0, this.chargeCooldown - dt);

      if (this.chargeTimer > 0) {
        this.chargeTimer -= dt;
        this.spriteMoving = true;
        this.moveSmart(game, this.chargeDir, this.speed * 2.35 * this.getMoveMul(), dt, { disallowReverse: true });
        for (const p of game.players) {
          if (!p.alive || this.chargeHitIds.has(p.id)) continue;
          if (Math.hypot(p.x - this.x, p.y - this.y) <= p.radius + this.radius + 2) {
            this.dealDamageToPlayer(p, this.damage * 1.35, game);
            this.chargeHitIds.add(p.id);
          }
        }
        return true;
      }

      if (has("storm") && this.eliteTimers.storm <= 0) {
        this.eliteTimers.storm = randFloat(2.2, 4.2);
        game.effects.push({
          kind: "enemy_storm",
          x: this.x,
          y: this.y,
          r: this.radius + 18,
          t: 0.2,
          color: "rgba(255,170,110,0.45)",
        });
        const cnt = this.type === "boss" ? 14 : 10;
        for (let i = 0; i < cnt; i += 1) {
          const a = (Math.PI * 2 * i) / cnt;
          this.fireProjectile(
            game,
            { x: Math.cos(a), y: Math.sin(a) },
            {
              speed: 210 + randInt(-20, 35),
              damage: this.damage * 0.58,
              radius: 5,
              ttl: 1.8,
              color: "#ff9f68",
              visual: "enemy_burst",
              trailColor: "rgba(255,175,115,0.55)",
            }
          );
        }
      }

      if (has("blink") && this.eliteTimers.blink <= 0 && dist < 260) {
        this.eliteTimers.blink = randFloat(3, 5.8);
        const dir = normalize(dx, dy) || { x: 1, y: 0 };
        const jitterX = randFloat(-35, 35);
        const jitterY = randFloat(-35, 35);
        const oldX = this.x;
        const oldY = this.y;
        this.x = clamp(
          target.x - dir.x * randFloat(48, 85) + jitterX,
          this.radius + 2,
          game.currentMap.widthPx - this.radius - 2
        );
        this.y = clamp(
          target.y - dir.y * randFloat(48, 85) + jitterY,
          this.radius + 2,
          game.currentMap.heightPx - this.radius - 2
        );
        this.resolveInvalidPosition(game);
        game.effects.push({
          kind: "enemy_blink",
          x: oldX,
          y: oldY,
          r: this.radius + 14,
          t: 0.16,
          color: "rgba(192,130,255,0.48)",
        });
        game.effects.push({
          kind: "enemy_blink",
          x: this.x,
          y: this.y,
          r: this.radius + 14,
          t: 0.16,
          color: "rgba(192,130,255,0.48)",
        });
        if (Math.hypot(target.x - this.x, target.y - this.y) <= this.radius + target.radius + 38) {
          this.dealDamageToPlayer(target, this.damage * 0.88, game);
        }
      }

      if (has("charge") && this.chargeCooldown <= 0 && dist > 60 && dist < 260) {
        const dir = normalize(dx, dy);
        if (dir) {
          this.chargeDir = dir;
          this.chargeTimer = 0.52;
          this.chargeCooldown = randFloat(2.4, 4.8);
          this.chargeHitIds.clear();
          game.effects.push({
            kind: "enemy_charge",
            x: this.x,
            y: this.y,
            r: this.radius + 20,
            t: 0.2,
            color: "rgba(255,122,122,0.5)",
            dirX: dir.x,
            dirY: dir.y,
          });
          return true;
        }
      }

      if (has("summoner") && this.eliteTimers.summon <= 0 && this.summonedCount < this.summonCap) {
        this.eliteTimers.summon = randFloat(4, 6.8);
        const waves = this.type === "boss" ? 2 : 1;
        for (let i = 0; i < waves; i += 1) {
          if (this.summonedCount >= this.summonCap) break;
          const summonType = Math.random() < 0.5 ? "grunt" : Math.random() < 0.7 ? "shooter" : "tank";
          const rx = this.x + randFloat(-55, 55);
          const ry = this.y + randFloat(-55, 55);
          const summon = new CG.Enemy(summonType, rx, ry, this.type === "boss" ? 0.95 : 0.82, {
            fromSummon: true,
            eliteMin: 1,
            eliteMax: 2,
            difficultyTier: this.difficultyTier,
          });
          if (CG.Collision.circleCollidesWithMap(game.currentMap, summon.x, summon.y, summon.radius)) {
            const pos = CG.MapSystem.getRandomOpenPosition(game.currentMap, summon.radius + 2);
            summon.x = pos.x;
            summon.y = pos.y;
          }
          game.effects.push({
            kind: "enemy_summon",
            x: summon.x,
            y: summon.y,
            r: summon.radius + 14,
            t: 0.2,
            color: "rgba(174,255,154,0.42)",
          });
          game.enemies.push(summon);
          this.summonedCount += 1;
        }
      }

      if (has("drain") && this.eliteTimers.drain <= 0) {
        this.eliteTimers.drain = randFloat(3.5, 5.5);
        const radius = this.type === "boss" ? 130 : 95;
        let absorbed = 0;
        for (const p of game.players) {
          if (!p.alive) continue;
          const d = Math.hypot(p.x - this.x, p.y - this.y);
          if (d > radius + p.radius) continue;
          absorbed += this.dealDamageToPlayer(p, this.damage * 0.6, game);
        }
        if (absorbed > 0) {
          this.hp = clamp(this.hp + absorbed * 0.4, 0, this.maxHp);
        }
        game.effects.push({
          kind: "enemy_drain",
          x: this.x,
          y: this.y,
          r: radius,
          t: 0.18,
          color: "rgba(193,95,255,0.38)",
        });
      }

      return false;
    }

    attackDamageAgainst(target) {
      let amount = this.damage;
      if (this.executeBonus > 0) {
        const hpRatio = target.hp / Math.max(1, target.stats.maxHp);
        if (hpRatio <= 0.42) amount *= 1 + this.executeBonus;
      }
      return amount;
    }

    update(dt, game) {
      if (!this.alive) return;
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      this.spriteAttackTimer = Math.max(0, this.spriteAttackTimer - dt);
      this.spriteHurtTimer = Math.max(0, this.spriteHurtTimer - dt);
      this.spriteMoving = false;
      this.resolveInvalidPosition(game);

      const target = nearestAlivePlayer(this, game.players);
      if (!target) return;

      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);
      this.spriteFacing = dx >= 0 ? 1 : -1;

      const consumedBySkill = this.updateEliteSkills(dt, game, target, dist, dx, dy);
      if (consumedBySkill) return;

      if (!this.isEnraged && this.enrageThreshold > 0 && this.hp / Math.max(1, this.maxHp) <= this.enrageThreshold) {
        this.isEnraged = true;
        this.damage *= this.enrageDamageMul;
        this.speed *= this.enrageSpeedMul;
        game.effects.push({
          kind: "enemy_charge",
          x: this.x,
          y: this.y,
          r: this.radius + 16,
          t: 0.2,
          color: "rgba(255,88,88,0.52)",
          dirX: this.spriteFacing || 1,
          dirY: 0,
        });
      }

      const moveMul = this.getMoveMul();
      if (this.def.ranged) {
        const prefer = 190;
        const retreat = normalize(-dx, -dy);
        if (dist < prefer && retreat) {
          this.moveSmart(game, retreat, this.speed * 0.75 * moveMul, dt, {
            target,
            preferRetreat: true,
            preferRange: prefer + 24,
          });
        } else {
          const chase = normalize(dx, dy);
          if (chase) {
            this.moveSmart(game, chase, this.speed * 0.4 * moveMul, dt, {
              target,
              preferRange: prefer,
            });
          }
        }

        if (this.attackTimer <= 0) {
          this.attackTimer = this.attackCooldown;
          this.spriteAttackDuration = 0.26;
          this.spriteAttackTimer = this.spriteAttackDuration;
          const dir = normalize(dx, dy);
          if (dir) {
            const shotFx = this.pickRangedShotProfile();
            this.fireSpread(game, dir, 1 + this.splitShots + this.volleyShots, 0.5 + this.volleyShots * 0.06, {
              speed: this.def.projectileSpeed,
              damage: this.damage,
              radius: 5,
              ttl: 2.45,
              color: shotFx.color,
              visual: shotFx.visual,
              trailColor: shotFx.trailColor,
            });
            if (this.arcaneChance > 0 && Math.random() < this.arcaneChance) {
              this.fireSpread(game, dir, 3, 0.35, {
                speed: (this.def.projectileSpeed || 220) * 0.82,
                damage: this.damage * 0.48,
                radius: 4,
                ttl: 1.6,
                color: "#d9a7ff",
                visual: "enemy_arcane",
                trailColor: "rgba(210,158,255,0.55)",
              });
            }
          }
        }
      } else {
        const dir = normalize(dx, dy);
        if (dir) {
          this.moveSmart(game, dir, this.speed * moveMul, dt, { target });
        }

        const hitDist = this.radius + target.radius + 4;
        if (dist < hitDist && this.attackTimer <= 0) {
          this.attackTimer = this.attackCooldown;
          this.spriteAttackDuration = 0.28;
          this.spriteAttackTimer = this.spriteAttackDuration;
          this.dealDamageToPlayer(target, this.attackDamageAgainst(target), game);
          game.effects.push({
            kind: "trail_slash",
            x: this.x,
            y: this.y,
            r: hitDist + 8,
            t: 0.14,
            color: this.hasEliteSkill("berserk") ? "rgba(255,120,120,0.42)" : "rgba(255,225,180,0.34)",
            dirX: dx,
            dirY: dy,
          });
          if (this.arcaneChance > 0 && Math.random() < this.arcaneChance) {
            const ad = normalize(dx, dy);
            if (ad) {
              this.fireProjectile(game, ad, {
                speed: 245,
                damage: this.damage * 0.55,
                radius: 4,
                ttl: 1.2,
                color: "#caa2ff",
                visual: "enemy_arcane",
                trailColor: "rgba(206,159,255,0.55)",
              });
            }
          }
        }
      }
    }

    draw(ctx) {
      const drawn = CG.SpriteSystem.drawEntity(ctx, this);
      if (!drawn) {
        ctx.fillStyle = this.def.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const w = this.radius * 2;
      const hpRatio = this.hp / this.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(this.x - w / 2, this.y - this.radius - 10, w, 4);
      ctx.fillStyle = "#5eff7c";
      ctx.fillRect(this.x - w / 2, this.y - this.radius - 10, w * hpRatio, 4);

      if (this.eliteSkills.length > 0) {
        const tag = this.eliteSkills
          .slice(0, 2)
          .map((s) => s.name)
          .join("·");
        ctx.fillStyle = "rgba(240,240,255,0.82)";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(tag, this.x, this.y - this.radius - 14);
      }

      if (this.traitTags.length > 0) {
        ctx.fillStyle = "rgba(255,220,182,0.86)";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(this.traitTags.slice(0, 2).join("·"), this.x, this.y - this.radius - 24);
      }
    }
  }

  CG.Enemy = Enemy;
})();
