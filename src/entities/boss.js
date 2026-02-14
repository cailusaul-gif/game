(() => {
  const CG = (window.CoopGame = window.CoopGame || {});
  const { normalize, nearestAlivePlayer, clamp, randFloat, randInt } = CG.Utils;

  const BOSS_PROFILES = [
    {
      key: "ashen_warden",
      name: "灰烬守望者",
      styleHint: "melee",
      crest: 0,
      core: "#f06f54",
      ring: "#ffd0ba",
      glow: "rgba(255,148,112,0.35)",
      sigil: "#ffab91",
    },
    {
      key: "moon_huntress",
      name: "月影猎手",
      styleHint: "ranged",
      crest: 1,
      core: "#6bb9ff",
      ring: "#dff5ff",
      glow: "rgba(126,204,255,0.32)",
      sigil: "#9edcff",
    },
    {
      key: "thorn_tyrant",
      name: "荆棘暴君",
      styleHint: "melee",
      crest: 2,
      core: "#79b95f",
      ring: "#d2ffc2",
      glow: "rgba(129,214,114,0.34)",
      sigil: "#95de82",
    },
    {
      key: "void_duke",
      name: "虚空公爵",
      styleHint: "ranged",
      crest: 3,
      core: "#ae7eff",
      ring: "#e9d8ff",
      glow: "rgba(188,146,255,0.34)",
      sigil: "#d4b9ff",
    },
    {
      key: "sunforge",
      name: "熔阳铸魂",
      styleHint: "melee",
      crest: 4,
      core: "#ff9952",
      ring: "#ffe8bb",
      glow: "rgba(255,183,105,0.34)",
      sigil: "#ffd06e",
    },
    {
      key: "storm_oracle",
      name: "风暴先知",
      styleHint: "ranged",
      crest: 5,
      core: "#50d2c2",
      ring: "#c7fff6",
      glow: "rgba(110,236,224,0.34)",
      sigil: "#8bf1e3",
    },
    {
      key: "blood_revenant",
      name: "血誓归魂",
      styleHint: "melee",
      crest: 6,
      core: "#ff647e",
      ring: "#ffd0dc",
      glow: "rgba(255,131,154,0.34)",
      sigil: "#ff93ae",
    },
    {
      key: "star_reaper",
      name: "星渊收割者",
      styleHint: "ranged",
      crest: 7,
      core: "#8b87ff",
      ring: "#e0e2ff",
      glow: "rgba(151,153,255,0.34)",
      sigil: "#b8bbff",
    },
    {
      key: "jade_colossus",
      name: "翡翠巨像",
      styleHint: "melee",
      crest: 8,
      core: "#7fdd85",
      ring: "#d9ffd5",
      glow: "rgba(145,228,151,0.32)",
      sigil: "#9fe39c",
    },
    {
      key: "dusk_archon",
      name: "暮界执政",
      styleHint: "ranged",
      crest: 9,
      core: "#ff8dbd",
      ring: "#ffe2ef",
      glow: "rgba(255,160,204,0.32)",
      sigil: "#ffc1dc",
    },
  ];

  const SKILL_LIBRARY = {
    melee: [
      { key: "cleave_fan", name: "裂空刀阵", weight: 15, cooldown: [2.2, 3.4], minDist: 40, maxDist: 260, consumeTurn: true },
      { key: "quake_ring", name: "震地重斩", weight: 12, cooldown: [3.2, 4.8], minDist: 0, maxDist: 180, consumeTurn: true },
      { key: "predator_dash", name: "猎杀突袭", weight: 12, cooldown: [3, 4.8], minDist: 80, maxDist: 340, consumeTurn: true },
      { key: "petal_tempest", name: "猩红风暴", weight: 10, cooldown: [4.1, 6], minDist: 0, maxDist: 9999, consumeTurn: true },
      { key: "void_rift", name: "裂隙束缚", weight: 9, cooldown: [4.5, 6.6], minDist: 0, maxDist: 9999, consumeTurn: false },
      { key: "war_howl", name: "战吼狂潮", weight: 8, cooldown: [6.5, 9], minDist: 0, maxDist: 9999, consumeTurn: false },
      { key: "scythe_cross", name: "十字斩波", weight: 10, cooldown: [2.6, 4], minDist: 45, maxDist: 290, consumeTurn: true },
      { key: "eruption_step", name: "熔踏震爆", weight: 8, cooldown: [4.2, 6.2], minDist: 0, maxDist: 220, consumeTurn: true },
      { key: "abyss_chain", name: "深渊锁链", weight: 8, cooldown: [4.4, 6.8], minDist: 0, maxDist: 9999, consumeTurn: false },
      { key: "rage_brand", name: "嗜战印记", weight: 7, cooldown: [6, 8.8], minDist: 0, maxDist: 9999, consumeTurn: false },
    ],
    ranged: [
      { key: "star_barrage", name: "星枪齐射", weight: 15, cooldown: [2.4, 3.8], minDist: 40, maxDist: 9999, consumeTurn: true },
      { key: "rune_cage", name: "符文囚笼", weight: 10, cooldown: [3.8, 5.6], minDist: 0, maxDist: 9999, consumeTurn: false },
      { key: "plasma_meteor", name: "等离子坠落", weight: 11, cooldown: [4.2, 6.2], minDist: 80, maxDist: 9999, consumeTurn: true },
      { key: "blink_salvo", name: "相位连击", weight: 12, cooldown: [3.3, 5.2], minDist: 70, maxDist: 320, consumeTurn: true },
      { key: "orbital_array", name: "轨道矩阵", weight: 9, cooldown: [5, 7.2], minDist: 0, maxDist: 9999, consumeTurn: true },
      { key: "summon_drones", name: "暗影援军", weight: 8, cooldown: [6.4, 9.2], minDist: 0, maxDist: 9999, consumeTurn: false },
      { key: "lance_march", name: "星矛行军", weight: 10, cooldown: [2.8, 4.2], minDist: 45, maxDist: 9999, consumeTurn: true },
      { key: "starfall", name: "群星坠雨", weight: 8, cooldown: [4.4, 6.4], minDist: 80, maxDist: 9999, consumeTurn: true },
      { key: "rift_volley", name: "裂界连发", weight: 9, cooldown: [4.2, 6.6], minDist: 0, maxDist: 9999, consumeTurn: false },
      { key: "phase_net", name: "相位罗网", weight: 8, cooldown: [4.1, 6.1], minDist: 0, maxDist: 9999, consumeTurn: true },
    ],
  };

  function rotateDir(dir, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      x: dir.x * c - dir.y * s,
      y: dir.x * s + dir.y * c,
    };
  }

  function pickBossProfile(style) {
    const pool = BOSS_PROFILES.filter((p) => p.styleHint === style || Math.random() < 0.22);
    const list = pool.length > 0 ? pool : BOSS_PROFILES;
    return list[randInt(0, list.length)];
  }

  function pickWeighted(pool, used) {
    const candidates = pool.filter((s) => !used.has(s.key));
    if (candidates.length <= 0) return null;
    const total = candidates.reduce((acc, s) => acc + s.weight, 0);
    let roll = Math.random() * total;
    for (const skill of candidates) {
      roll -= skill.weight;
      if (roll <= 0) return skill;
    }
    return candidates[0];
  }

  function buildSkillLoadout(style, count, levelIndex) {
    const base = SKILL_LIBRARY[style] || SKILL_LIBRARY.melee;
    let lib = base;

    if (levelIndex <= 1) {
      const ban =
        style === "melee"
          ? new Set(["petal_tempest", "abyss_chain", "eruption_step", "rage_brand"])
          : new Set(["plasma_meteor", "orbital_array", "starfall", "rift_volley"]);
      lib = base.filter((s) => !ban.has(s.key));
    } else if (levelIndex <= 3) {
      const ban = style === "melee" ? new Set(["petal_tempest", "abyss_chain"]) : new Set(["orbital_array", "starfall"]);
      lib = base.filter((s) => !ban.has(s.key));
    }

    const used = new Set();
    const list = [];
    for (let i = 0; i < count; i += 1) {
      const skill = pickWeighted(lib, used);
      if (!skill) break;
      used.add(skill.key);
      list.push(skill);
    }
    return list;
  }

  class Boss extends CG.Enemy {
    constructor(x, y, options) {
      const opts = options || {};
      const tier = Math.max(0, opts.difficultyTier || 0);
      const levelIndex = Math.max(1, opts.levelIndex || 1);
      const bonusSkills = Math.max(0, opts.bonusSkills ?? tier);
      const style = opts.bossStyle || (Math.random() < 0.5 ? "melee" : "ranged");
      const earlyCurve =
        levelIndex === 1
          ? { hp: 0.58, damage: 0.68, speed: 0.88, atkCd: 1.28, skillCd: 1.25, skillStart: 1.6, elite: 2, skills: 2 }
          : levelIndex === 2
            ? { hp: 0.74, damage: 0.8, speed: 0.94, atkCd: 1.14, skillCd: 1.12, skillStart: 1.35, elite: 2, skills: 2 }
            : levelIndex === 3
              ? { hp: 0.86, damage: 0.9, speed: 0.97, atkCd: 1.08, skillCd: 1.06, skillStart: 1.15, elite: 3, skills: 3 }
              : { hp: 1, damage: 1, speed: 1, atkCd: 1, skillCd: 1, skillStart: 1, elite: 4, skills: 3 };

      super("tank", x, y, 2.9, {
        isBoss: true,
        eliteCount: earlyCurve.elite + bonusSkills,
        difficultyTier: tier,
      });

      this.type = "boss";
      this.levelIndex = levelIndex;
      this.bossStyle = style;
      this.profile = pickBossProfile(style);
      this.progressionTier = tier;

      const styleMul = style === "melee"
        ? { hp: 1.26, dmg: 1.18, spd: 1.1, atkCd: 0.9, radius: 31 }
        : { hp: 1.08, dmg: 1.02, spd: 1.02, atkCd: 1.07, radius: 28 };

      this.radius = Math.max(this.radius, styleMul.radius);
      this.speed = Math.max(this.speed * styleMul.spd * earlyCurve.speed, (style === "melee" ? 104 : 94) * earlyCurve.speed);
      this.attackCooldown = Math.min(this.attackCooldown * styleMul.atkCd * earlyCurve.atkCd, (style === "melee" ? 0.98 : 1.18) * earlyCurve.atkCd);
      this.damage =
        Math.max(this.damage, style === "melee" ? 38 : 34) *
        styleMul.dmg *
        Math.pow(1.1, tier) *
        earlyCurve.damage;
      this.maxHp =
        Math.max(this.maxHp * styleMul.hp, style === "melee" ? 1340 : 1180) *
        (1 + tier * 0.03) *
        earlyCurve.hp;
      this.hp = this.maxHp;
      this.goldDrop = Math.floor(190 * (1 + tier * 0.08));
      this.xpDrop = Math.floor(330 * (1 + tier * 0.1));
      this.potionDropChance = 1;
      this.spriteScale = Math.max(this.spriteScale, 0.148);
      this.spriteYOffset = 12;
      this.def = {
        name: this.profile.name,
        color: this.profile.core,
      };

      this.skillCooldownMul = earlyCurve.skillCd;
      this.skillLoadout = buildSkillLoadout(this.bossStyle, earlyCurve.skills + bonusSkills, this.levelIndex);
      this.skillTimers = {};
      for (const skill of this.skillLoadout) {
        this.skillTimers[skill.key] = randFloat(0.6 * earlyCurve.skillStart, 2.2 * earlyCurve.skillStart);
      }
      this.skillGlobalTimer = 1.1 * earlyCurve.skillStart;
      this.lastSkillName = "";
      this.lastSkillTimer = 0;

      this.dashTimer = 0;
      this.dashDir = { x: 1, y: 0 };
      this.dashHit = new Set();

      this.ferocityTimer = 0;
      this.ferocityDamageMul = 1;
      this.ferocitySpeedMul = 1;
      this.preferRange = randInt(180, 245);
      this.summonSkillCount = 0;
      this.runePhase = Math.random() * Math.PI * 2;
    }

    getDamageMul() {
      return this.ferocityTimer > 0 ? this.ferocityDamageMul : 1;
    }

    getMoveMul() {
      const slowMul = super.getMoveMul();
      const rageMul = this.ferocityTimer > 0 ? this.ferocitySpeedMul : 1;
      return slowMul * rageMul;
    }

    setSkillTimer(skill) {
      const [minCd, maxCd] = skill.cooldown || [3, 5];
      this.skillTimers[skill.key] = randFloat(minCd * this.skillCooldownMul, maxCd * this.skillCooldownMul);
    }

    tickSkills(dt) {
      for (const key of Object.keys(this.skillTimers)) {
        this.skillTimers[key] -= dt;
      }
      this.skillGlobalTimer = Math.max(0, this.skillGlobalTimer - dt);
      this.lastSkillTimer = Math.max(0, this.lastSkillTimer - dt);
      this.ferocityTimer = Math.max(0, this.ferocityTimer - dt);
      if (this.ferocityTimer <= 0) {
        this.ferocityDamageMul = 1;
        this.ferocitySpeedMul = 1;
      }
    }

    chooseReadySkill(dist) {
      if (this.skillGlobalTimer > 0) return null;

      const ready = this.skillLoadout.filter((skill) => {
        if ((this.skillTimers[skill.key] || 0) > 0) return false;
        if (typeof skill.minDist === "number" && dist < skill.minDist) return false;
        if (typeof skill.maxDist === "number" && dist > skill.maxDist) return false;
        return true;
      });
      if (ready.length <= 0) return null;

      const weighted = ready.map((skill) => {
        let score = skill.weight;
        if (this.bossStyle === "melee") {
          if (dist < 120) score += 4;
          if (skill.key === "predator_dash" && dist > 140) score += 5;
        } else {
          if (dist > this.preferRange - 20) score += 4;
          if (skill.key === "blink_salvo" && dist < this.preferRange) score += 4;
        }
        return { skill, score: Math.max(1, score) };
      });

      const total = weighted.reduce((acc, w) => acc + w.score, 0);
      let roll = Math.random() * total;
      for (const entry of weighted) {
        roll -= entry.score;
        if (roll <= 0) return entry.skill;
      }
      return weighted[0].skill;
    }

    firePatternTowards(game, dir, count, arc, options) {
      if (!dir) return;
      const total = Math.max(1, count);
      const spreadArc = arc || 0.45;
      for (let i = 0; i < total; i += 1) {
        const t = total === 1 ? 0 : i / (total - 1);
        const delta = (t - 0.5) * spreadArc;
        const shot = rotateDir(dir, delta);
        this.fireProjectile(game, shot, options);
      }
    }

    castCleaveFan(game, dir) {
      if (!dir) return true;
      game.effects.push({
        kind: "boss_melee_cast",
        x: this.x,
        y: this.y,
        r: this.radius + 26,
        t: 0.24,
        color: this.profile.glow,
      });
      this.firePatternTowards(game, dir, 5, 0.92, {
        speed: 320,
        damage: this.damage * this.getDamageMul() * 0.66,
        radius: 7,
        ttl: 1.3,
        color: this.profile.sigil,
        visual: "boss_scythe",
        trailColor: `${this.profile.sigil}88`,
      });
      return true;
    }

    castQuakeRing(game) {
      const radius = 118;
      for (const p of game.players) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - this.x, p.y - this.y);
        if (d > radius + p.radius) continue;
        this.dealDamageToPlayer(p, this.damage * this.getDamageMul() * 1.18, game);
      }
      game.effects.push({
        kind: "shockwave",
        x: this.x,
        y: this.y,
        r: radius,
        t: 0.24,
        color: this.profile.glow,
      });
      return true;
    }

    castDash(dir, game) {
      if (!dir) return false;
      this.dashDir = dir;
      this.dashTimer = 0.5;
      this.dashHit.clear();
      game.effects.push({
        kind: "boss_dash",
        x: this.x,
        y: this.y,
        r: this.radius + 22,
        t: 0.2,
        color: this.profile.sigil,
        dirX: dir.x,
        dirY: dir.y,
      });
      return true;
    }

    castPetalTempest(game) {
      const count = 16;
      for (let i = 0; i < count; i += 1) {
        const a = (Math.PI * 2 * i) / count + this.runePhase;
        this.fireProjectile(game, { x: Math.cos(a), y: Math.sin(a) }, {
          speed: 250,
          damage: this.damage * this.getDamageMul() * 0.52,
          radius: 6,
          ttl: 2.2,
          color: this.profile.sigil,
          visual: "enemy_boss_petal",
          trailColor: `${this.profile.sigil}88`,
        });
      }
      game.effects.push({
        kind: "boss_melee_cast",
        x: this.x,
        y: this.y,
        r: this.radius + 34,
        t: 0.26,
        color: this.profile.glow,
      });
      this.runePhase += 0.4;
      return true;
    }

    castVoidRift(game, target, isRuneMode) {
      if (!target) return false;
      const spikes = this.bossStyle === "ranged" ? 8 : 6;
      const ring = this.bossStyle === "ranged" ? 86 : 68;

      for (let i = 0; i < spikes; i += 1) {
        const a = (Math.PI * 2 * i) / spikes + this.runePhase;
        const sx = clamp(target.x + Math.cos(a) * ring, this.radius + 4, game.currentMap.widthPx - this.radius - 4);
        const sy = clamp(target.y + Math.sin(a) * ring, this.radius + 4, game.currentMap.heightPx - this.radius - 4);
        const dir = normalize(target.x - sx, target.y - sy) || { x: Math.cos(a + Math.PI), y: Math.sin(a + Math.PI) };

        game.projectiles.push(
          new CG.Projectile(sx, sy, dir.x * 220, dir.y * 220, {
            owner: "enemy",
            damage: this.damage * this.getDamageMul() * 0.45,
            radius: 5,
            ttl: 1.9,
            color: this.profile.sigil,
            sourceEnemy: this,
            visual: isRuneMode ? "rune_disc" : "void_spike",
            trailColor: `${this.profile.sigil}88`,
          })
        );
      }

      game.effects.push({
        kind: "boss_rift",
        x: target.x,
        y: target.y,
        r: ring + 16,
        t: 0.26,
        color: this.profile.glow,
      });
      this.runePhase += 0.6;
      return false;
    }

    castWarHowl(game) {
      this.ferocityDamageMul = Math.max(this.ferocityDamageMul, 1.22 + this.progressionTier * 0.03);
      this.ferocitySpeedMul = Math.max(this.ferocitySpeedMul, 1.14 + this.progressionTier * 0.02);
      this.ferocityTimer = Math.max(this.ferocityTimer, 3.8);
      game.effects.push({
        kind: "boss_melee_cast",
        x: this.x,
        y: this.y,
        r: this.radius + 30,
        t: 0.28,
        color: "rgba(255,132,132,0.45)",
      });
      return false;
    }

    castStarBarrage(game, target) {
      const targets = game.players.filter((p) => p.alive);
      if (targets.length <= 0) return true;
      for (const p of targets) {
        const dir = normalize(p.x - this.x, p.y - this.y);
        if (!dir) continue;
        this.firePatternTowards(game, dir, 3, 0.34, {
          speed: 300,
          damage: this.damage * this.getDamageMul() * 0.52,
          radius: 5,
          ttl: 2,
          color: this.profile.sigil,
          visual: "boss_lance",
          trailColor: `${this.profile.sigil}88`,
        });
      }
      game.effects.push({
        kind: "boss_ranged_cast",
        x: this.x,
        y: this.y,
        r: this.radius + 30,
        t: 0.24,
        color: this.profile.glow,
      });
      return true;
    }

    castPlasmaMeteor(game, target) {
      const targets = game.players.filter((p) => p.alive);
      if (targets.length <= 0) return true;
      for (const p of targets) {
        const dir = normalize(p.x - this.x, p.y - this.y);
        if (!dir) continue;
        this.fireProjectile(game, dir, {
          speed: 215,
          damage: this.damage * this.getDamageMul() * 0.9,
          radius: 8,
          ttl: 2.4,
          color: "#ffb36f",
          visual: "plasma_orb",
          trailColor: "rgba(255,188,120,0.58)",
        });
      }
      game.effects.push({
        kind: "plasma_burst",
        x: this.x,
        y: this.y,
        r: this.radius + 38,
        t: 0.24,
        color: "rgba(255,188,120,0.45)",
      });
      return true;
    }

    castBlinkSalvo(game, target) {
      if (!target) return false;
      const to = normalize(target.x - this.x, target.y - this.y) || { x: 1, y: 0 };
      const oldX = this.x;
      const oldY = this.y;
      this.x = clamp(target.x - to.x * randFloat(110, 165) + randFloat(-26, 26), this.radius + 2, game.currentMap.widthPx - this.radius - 2);
      this.y = clamp(target.y - to.y * randFloat(110, 165) + randFloat(-26, 26), this.radius + 2, game.currentMap.heightPx - this.radius - 2);
      this.resolveInvalidPosition(game);

      game.effects.push({
        kind: "enemy_blink",
        x: oldX,
        y: oldY,
        r: this.radius + 16,
        t: 0.16,
        color: this.profile.glow,
      });
      game.effects.push({
        kind: "enemy_blink",
        x: this.x,
        y: this.y,
        r: this.radius + 16,
        t: 0.16,
        color: this.profile.glow,
      });

      const dir = normalize(target.x - this.x, target.y - this.y);
      if (dir) {
        this.firePatternTowards(game, dir, 5, 0.52, {
          speed: 286,
          damage: this.damage * this.getDamageMul() * 0.46,
          radius: 5,
          ttl: 1.65,
          color: this.profile.sigil,
          visual: "boss_lance",
          trailColor: `${this.profile.sigil}88`,
        });
      }
      return true;
    }

    castOrbitalArray(game) {
      const count = 18;
      for (let i = 0; i < count; i += 1) {
        const a = (Math.PI * 2 * i) / count;
        this.fireProjectile(game, { x: Math.cos(a), y: Math.sin(a) }, {
          speed: 258,
          damage: this.damage * this.getDamageMul() * 0.44,
          radius: 5,
          ttl: 2.4,
          color: this.profile.sigil,
          visual: "star_lance",
          trailColor: `${this.profile.sigil}88`,
        });
      }
      game.effects.push({
        kind: "boss_ranged_cast",
        x: this.x,
        y: this.y,
        r: this.radius + 40,
        t: 0.26,
        color: this.profile.glow,
      });
      return true;
    }

    castSummonDrones(game) {
      const cap = this.bossStyle === "ranged" ? 5 : 4;
      if (this.summonSkillCount >= cap) return false;
      const toSpawn = Math.min(2 + (this.progressionTier >= 2 ? 1 : 0), cap - this.summonSkillCount);
      for (let i = 0; i < toSpawn; i += 1) {
        const kind = this.bossStyle === "ranged" ? (Math.random() < 0.72 ? "shooter" : "grunt") : (Math.random() < 0.65 ? "grunt" : "tank");
        const pos = CG.MapSystem.getRandomOpenPosition(game.currentMap, 18);
        const add = new CG.Enemy(kind, pos.x, pos.y, 0.9 + Math.random() * 0.16, {
          fromSummon: true,
          eliteMin: 1,
          eliteMax: 2,
          difficultyTier: this.difficultyTier,
        });
        game.enemies.push(add);
        game.effects.push({
          kind: "summon_sigil",
          x: add.x,
          y: add.y,
          r: add.radius + 12,
          t: 0.2,
          color: this.profile.glow,
        });
      }
      this.summonSkillCount += toSpawn;
      return false;
    }

    castSkill(skill, game, target, dist, dir) {
      if (!skill) return false;
      this.lastSkillName = skill.name;
      this.lastSkillTimer = 1.8;

      if (skill.key === "cleave_fan" || skill.key === "scythe_cross") return this.castCleaveFan(game, dir);
      if (skill.key === "quake_ring" || skill.key === "eruption_step") return this.castQuakeRing(game);
      if (skill.key === "predator_dash") return this.castDash(dir, game);
      if (skill.key === "petal_tempest") return this.castPetalTempest(game);
      if (skill.key === "void_rift" || skill.key === "abyss_chain") return this.castVoidRift(game, target, false);
      if (skill.key === "war_howl" || skill.key === "rage_brand") return this.castWarHowl(game);

      if (skill.key === "star_barrage" || skill.key === "lance_march") return this.castStarBarrage(game, target);
      if (skill.key === "rune_cage" || skill.key === "rift_volley") return this.castVoidRift(game, target, true);
      if (skill.key === "plasma_meteor" || skill.key === "starfall") return this.castPlasmaMeteor(game, target);
      if (skill.key === "blink_salvo" || skill.key === "phase_net") return this.castBlinkSalvo(game, target);
      if (skill.key === "orbital_array") return this.castOrbitalArray(game);
      if (skill.key === "summon_drones") return this.castSummonDrones(game);

      return false;
    }

    updateDash(dt, game) {
      if (this.dashTimer <= 0) return false;
      this.dashTimer -= dt;
      this.spriteMoving = true;
      this.moveSmart(game, this.dashDir, this.speed * 2.65 * this.getMoveMul(), dt, { disallowReverse: true });

      for (const p of game.players) {
        if (!p.alive || this.dashHit.has(p.id)) continue;
        if (Math.hypot(p.x - this.x, p.y - this.y) <= p.radius + this.radius + 3) {
          this.dealDamageToPlayer(p, this.damage * this.getDamageMul() * 1.32, game);
          this.dashHit.add(p.id);
        }
      }

      return true;
    }

    update(dt, game) {
      if (!this.alive) return;

      this.spriteAttackTimer = Math.max(0, this.spriteAttackTimer - dt);
      this.spriteHurtTimer = Math.max(0, this.spriteHurtTimer - dt);
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      this.spriteMoving = false;

      this.tickSkills(dt);
      this.resolveInvalidPosition(game);

      const target = nearestAlivePlayer(this, game.players);
      if (!target) return;

      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);
      const dir = normalize(dx, dy);
      this.spriteFacing = dx >= 0 ? 1 : -1;

      const consumedByElite = this.updateEliteSkills(dt, game, target, dist, dx, dy);
      if (consumedByElite) return;

      if (this.updateDash(dt, game)) return;

      const skill = this.chooseReadySkill(dist);
      if (skill) {
        const consumed = this.castSkill(skill, game, target, dist, dir);
        this.setSkillTimer(skill);
        this.skillGlobalTimer = skill.consumeTurn ? 0.62 : 0.36;
        this.spriteAttackDuration = 0.34;
        this.spriteAttackTimer = this.spriteAttackDuration;
        if (consumed) return;
      }

      const moveMul = this.getMoveMul();
      if (this.bossStyle === "ranged") {
        const retreat = normalize(-dx, -dy);
        if (dist < this.preferRange - 20 && retreat) {
          this.moveSmart(game, retreat, this.speed * 0.8 * moveMul, dt, {
            target,
            preferRetreat: true,
            preferRange: this.preferRange + 24,
          });
        } else if (dir) {
          this.moveSmart(game, dir, this.speed * 0.45 * moveMul, dt, {
            target,
            preferRange: this.preferRange,
          });
        }
      } else if (dir) {
        this.moveSmart(game, dir, this.speed * moveMul, dt, { target });
      }

      const meleeRange = this.radius + target.radius + 10;
      if (dist < meleeRange && this.attackTimer <= 0) {
        this.attackTimer = this.attackCooldown;
        this.spriteAttackDuration = 0.3;
        this.spriteAttackTimer = this.spriteAttackDuration;
        this.dealDamageToPlayer(target, this.attackDamageAgainst(target) * (this.bossStyle === "melee" ? 1.26 : 1.02) * this.getDamageMul(), game);
        game.effects.push({
          kind: "trail_slash",
          x: this.x,
          y: this.y,
          r: meleeRange,
          t: 0.16,
          color: this.profile.glow,
          dirX: dir ? dir.x : this.spriteFacing,
          dirY: dir ? dir.y : 0,
        });
      } else if (this.bossStyle === "ranged" && this.attackTimer <= 0 && dir) {
        this.attackTimer = this.attackCooldown;
        this.spriteAttackDuration = 0.26;
        this.spriteAttackTimer = this.spriteAttackDuration;
        this.firePatternTowards(game, dir, 3 + Math.min(2, Math.floor(this.progressionTier / 2)), 0.34, {
          speed: 268,
          damage: this.damage * 0.48 * this.getDamageMul(),
          radius: 5,
          ttl: 1.9,
          color: this.profile.sigil,
          visual: this.progressionTier >= 2 ? "star_lance" : "enemy_spear",
          trailColor: `${this.profile.sigil}80`,
        });
      }
    }

    drawProfileOverlay(ctx) {
      const pulse = 1 + Math.sin(performance.now() * 0.004 + this.runePhase) * 0.05;
      const ringR = this.radius + 5;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(pulse, pulse);

      ctx.fillStyle = this.profile.glow;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = this.profile.ring;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = this.profile.sigil;
      ctx.lineWidth = 2;
      const c = this.profile.crest;

      if (c === 0) {
        ctx.beginPath();
        ctx.moveTo(-ringR * 0.65, -ringR * 0.35);
        ctx.lineTo(-ringR * 0.2, -ringR * 0.85);
        ctx.lineTo(ringR * 0.2, -ringR * 0.85);
        ctx.lineTo(ringR * 0.65, -ringR * 0.35);
        ctx.stroke();
      } else if (c === 1) {
        ctx.beginPath();
        ctx.arc(0, -ringR * 0.55, ringR * 0.34, 0.1, Math.PI - 0.1);
        ctx.stroke();
      } else if (c === 2) {
        for (let i = 0; i < 4; i += 1) {
          const a = i * Math.PI * 0.5 + 0.2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * ringR * 0.76, Math.sin(a) * ringR * 0.76);
          ctx.lineTo(Math.cos(a) * ringR * 1.03, Math.sin(a) * ringR * 1.03);
          ctx.stroke();
        }
      } else if (c === 3) {
        ctx.beginPath();
        ctx.moveTo(0, -ringR * 0.95);
        ctx.lineTo(ringR * 0.36, -ringR * 0.2);
        ctx.lineTo(0, ringR * 0.25);
        ctx.lineTo(-ringR * 0.36, -ringR * 0.2);
        ctx.closePath();
        ctx.stroke();
      } else if (c === 4) {
        ctx.beginPath();
        ctx.arc(0, -ringR * 0.35, ringR * 0.38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-ringR * 0.4, ringR * 0.08);
        ctx.lineTo(ringR * 0.4, ringR * 0.08);
        ctx.stroke();
      } else if (c === 5) {
        ctx.beginPath();
        ctx.moveTo(-ringR * 0.75, -ringR * 0.1);
        ctx.lineTo(ringR * 0.75, -ringR * 0.1);
        ctx.moveTo(-ringR * 0.55, ringR * 0.32);
        ctx.lineTo(ringR * 0.55, ringR * 0.32);
        ctx.stroke();
      } else if (c === 6) {
        for (let i = 0; i < 5; i += 1) {
          const a = (Math.PI * 2 * i) / 5 - Math.PI * 0.5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * ringR * 0.65, Math.sin(a) * ringR * 0.65);
          ctx.lineTo(Math.cos(a) * ringR * 0.95, Math.sin(a) * ringR * 0.95);
          ctx.stroke();
        }
      } else if (c === 7) {
        ctx.beginPath();
        ctx.arc(0, 0, ringR * 0.52, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-ringR * 0.4, -ringR * 0.4);
        ctx.lineTo(ringR * 0.4, ringR * 0.4);
        ctx.moveTo(ringR * 0.4, -ringR * 0.4);
        ctx.lineTo(-ringR * 0.4, ringR * 0.4);
        ctx.stroke();
      } else if (c === 8) {
        ctx.beginPath();
        ctx.ellipse(0, -ringR * 0.2, ringR * 0.65, ringR * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        for (let i = 0; i < 3; i += 1) {
          ctx.beginPath();
          ctx.arc(0, 0, ringR * (0.42 + i * 0.15), 0.5 + i * 0.3, 2.6 + i * 0.3);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    draw(ctx) {
      const drawn = CG.SpriteSystem.drawEntity(ctx, this);
      if (!drawn) {
        ctx.fillStyle = this.profile.core;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      this.drawProfileOverlay(ctx);

      const w = 240;
      const hpRatio = this.hp / this.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.52)";
      ctx.fillRect(this.x - w / 2, this.y - this.radius - 26, w, 9);
      ctx.fillStyle = this.profile.core;
      ctx.fillRect(this.x - w / 2, this.y - this.radius - 26, w * hpRatio, 9);

      ctx.fillStyle = "rgba(255,242,250,0.92)";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      const styleLabel = this.bossStyle === "melee" ? "近战系" : "远程系";
      ctx.fillText(`${this.profile.name} · ${styleLabel} · T${this.progressionTier + 1}`, this.x, this.y - this.radius - 34);

      const tree = this.skillLoadout
        .slice(0, 3)
        .map((s) => s.name)
        .join(" · ");
      if (tree) {
        ctx.fillStyle = "rgba(255,229,238,0.9)";
        ctx.fillText(tree, this.x, this.y - this.radius - 44);
      }

      if (this.lastSkillTimer > 0 && this.lastSkillName) {
        ctx.fillStyle = this.profile.sigil;
        ctx.fillText(`施放: ${this.lastSkillName}`, this.x, this.y + this.radius + 16);
      }
    }
  }

  CG.Boss = Boss;
})();
