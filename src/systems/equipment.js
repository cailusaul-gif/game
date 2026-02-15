(() => {
  const CG = (window.CoopGame = window.CoopGame || {});
  const { SLOT_KEYS, SLOT_LABELS, ITEM_PREFIX, ITEM_RARITY } = CG.CONSTANTS;
  const { randInt, randFloat, clamp } = CG.Utils;

  const POWER_DEFS = [
    {
      key: "chain",
      name: "\u96F7\u94FE",
      trigger: "onHit",
      weight: 12,
      slots: ["weapon", "accessory"],
      chance: [0.12, 0.24],
      cooldown: [1.3, 2.2],
      power: [0.35, 0.75],
      bounces: [2, 5],
      radius: [95, 145],
    },
    {
      key: "nova",
      name: "\u70C8\u7130\u65B0\u661F",
      trigger: "onHit",
      weight: 10,
      slots: ["weapon", "armor"],
      chance: [0.12, 0.22],
      cooldown: [1.8, 2.8],
      power: [0.45, 0.95],
      radius: [48, 84],
    },
    {
      key: "execution",
      name: "\u65A9\u6740",
      trigger: "onHit",
      weight: 8,
      slots: ["weapon"],
      chance: [0.09, 0.2],
      cooldown: [1.7, 2.6],
      power: [0.2, 0.45],
      threshold: [0.15, 0.32],
    },
    {
      key: "shadow_shot",
      name: "\u5F71\u88AD\u98DE\u5203",
      trigger: "onHit",
      weight: 10,
      slots: ["weapon", "boots"],
      chance: [0.14, 0.26],
      cooldown: [1.1, 1.9],
      power: [0.5, 0.9],
      count: [2, 4],
    },
    {
      key: "blood_rush",
      name: "\u55DC\u8840\u5954\u88AD",
      trigger: "onKill",
      weight: 9,
      slots: ["weapon", "boots", "accessory"],
      chance: [0.22, 0.42],
      cooldown: [4.2, 6.4],
      heal: [8, 26],
      speedMul: [1.08, 1.28],
      damageMul: [1.08, 1.26],
      duration: [1.8, 3.8],
    },
    {
      key: "arcane_ring",
      name: "\u5965\u672F\u661F\u73AF",
      trigger: "onSkill",
      weight: 9,
      slots: ["accessory", "weapon"],
      chance: [0.26, 0.48],
      cooldown: [4.6, 7.8],
      power: [0.35, 0.8],
      bolts: [6, 12],
    },
    {
      key: "barrier",
      name: "\u76F8\u4F4D\u62A4\u76FE",
      trigger: "onDamaged",
      weight: 10,
      slots: ["armor", "accessory"],
      chance: [0.16, 0.3],
      cooldown: [5, 8],
      shield: [14, 58],
      duration: [2.2, 4.8],
    },
    {
      key: "frost_guard",
      name: "\u971C\u73AF\u53CD\u5236",
      trigger: "onDamaged",
      weight: 8,
      slots: ["armor", "boots"],
      chance: [0.18, 0.32],
      cooldown: [3.4, 5.8],
      power: [0.4, 0.9],
      radius: [72, 130],
      slow: [0.65, 0.84],
      slowDuration: [1.2, 2.8],
    },
    {
      key: "time_warp",
      name: "\u65F6\u9699\u56DE\u6EAF",
      trigger: "onCrit",
      weight: 7,
      slots: ["accessory", "boots"],
      chance: [0.14, 0.28],
      cooldown: [3.6, 6.2],
      skillRefund: [0.35, 0.72],
      rollRefund: [0.22, 0.56],
    },
    {
      key: "meteor",
      name: "\u9668\u706B",
      trigger: "onCrit",
      weight: 7,
      slots: ["weapon", "accessory"],
      chance: [0.12, 0.24],
      cooldown: [2.8, 4.6],
      power: [0.65, 1.25],
      radius: [55, 95],
    },
    {
      key: "echo",
      name: "\u6218\u6280\u56DE\u54CD",
      trigger: "onSkill",
      weight: 8,
      slots: ["weapon", "armor", "accessory"],
      chance: [0.2, 0.42],
      cooldown: [3.8, 6.5],
      power: [0.2, 0.5],
      duration: [2.4, 4.8],
    },
    {
      key: "lucky_star",
      name: "\u5E78\u8FD0\u661F\u8F89",
      trigger: "onHit",
      weight: 7,
      slots: ["accessory"],
      chance: [0.08, 0.18],
      cooldown: [1.1, 2.3],
      gold: [1, 4],
      xp: [1, 4],
    },
  ];

  const ITEM_GROWTH_CURVE = [
    { minRarity: "common", statScale: 1, powerScale: 1, rarityBoost: 0 },
    { minRarity: "common", statScale: 1.08, powerScale: 1.05, rarityBoost: 0.18 },
    { minRarity: "rare", statScale: 1.16, powerScale: 1.1, rarityBoost: 0.28 },
    { minRarity: "rare", statScale: 1.26, powerScale: 1.16, rarityBoost: 0.4 },
    { minRarity: "epic", statScale: 1.38, powerScale: 1.23, rarityBoost: 0.55 },
    { minRarity: "epic", statScale: 1.52, powerScale: 1.3, rarityBoost: 0.72 },
    { minRarity: "legendary", statScale: 1.68, powerScale: 1.38, rarityBoost: 0.9 },
  ];

  function makeStarterItem(classKey) {
    if (classKey === "samurai") {
      return {
        slot: "weapon",
        name: "\u6B66\u58EB\u5200",
        rarity: ITEM_RARITY[0],
        bonuses: { damage: 6, critChance: 0.03 },
        powers: [],
      };
    }
    if (classKey === "archer") {
      return {
        slot: "weapon",
        name: "\u786C\u6728\u957F\u5F13",
        rarity: ITEM_RARITY[0],
        bonuses: { damage: 4, attackCooldown: -0.03, critChance: 0.04 },
        powers: [],
      };
    }
    return {
      slot: "weapon",
      name: "\u5B66\u5F92\u6CD5\u6756",
      rarity: ITEM_RARITY[0],
      bonuses: { damage: 5, projectileSpeed: 30, skillHaste: 0.05 },
      powers: [],
    };
  }

  function makeBasicItem(slot) {
    const base = {
      weapon: { damage: 2, critChance: 0.01 },
      armor: { maxHp: 8, defense: 0.02 },
      boots: { speed: 6 },
      accessory: { damage: 1, skillHaste: 0.03 },
    };

    return {
      slot,
      name: `\u57FA\u7840${SLOT_LABELS[slot]}`,
      rarity: ITEM_RARITY[0],
      bonuses: base[slot],
      powers: [],
    };
  }

  function rarityIndex(rarityKey) {
    if (!rarityKey) return -1;
    return ITEM_RARITY.findIndex((r) => r.key === rarityKey);
  }

  function higherRarityKey(a, b) {
    const aIndex = rarityIndex(a);
    const bIndex = rarityIndex(b);
    const index = Math.max(aIndex, bIndex, 0);
    return ITEM_RARITY[index] ? ITEM_RARITY[index].key : ITEM_RARITY[0].key;
  }

  function growthTierFromLevel(levelIndex) {
    const level = Math.max(1, Math.floor(levelIndex || 1));
    return Math.floor((level - 1) / 3);
  }

  function getGrowthForLevel(levelIndex) {
    const tier = growthTierFromLevel(levelIndex);
    if (tier < ITEM_GROWTH_CURVE.length) {
      return ITEM_GROWTH_CURVE[tier];
    }

    const last = ITEM_GROWTH_CURVE[ITEM_GROWTH_CURVE.length - 1];
    const extra = tier - (ITEM_GROWTH_CURVE.length - 1);
    return {
      minRarity: last.minRarity,
      statScale: last.statScale * (1 + extra * 0.08),
      powerScale: last.powerScale * (1 + extra * 0.07),
      rarityBoost: Math.min(1.45, last.rarityBoost + extra * 0.08),
    };
  }

  function pickWeighted(arr, usedKeys) {
    const pool = arr.filter((p) => !usedKeys.has(p.key));
    if (pool.length <= 0) return null;
    const total = pool.reduce((acc, p) => acc + p.weight, 0);
    let roll = Math.random() * total;
    for (const p of pool) {
      roll -= p.weight;
      if (roll <= 0) return p;
    }
    return pool[0];
  }

  function rollInRange([min, max], qualityMul) {
    const t = randFloat(min, max);
    return t * (1 + (qualityMul - 1) * 0.65);
  }

  function rollProcCount(rarity, powerScale) {
    const extraProcChance = clamp((powerScale - 1) * 0.55, 0, 0.45);
    if (rarity.key === "legendary") {
      return randInt(2, 4) + (Math.random() < extraProcChance ? 1 : 0);
    }
    if (rarity.key === "epic") {
      return randInt(1, 3) + (Math.random() < extraProcChance * 0.75 ? 1 : 0);
    }
    if (rarity.key === "rare") return Math.random() < 0.75 + extraProcChance * 0.4 ? 1 : 0;
    return Math.random() < 0.28 + extraProcChance * 0.5 ? 1 : 0;
  }

  function makePower(def, slot, rarity, powerScale) {
    const qualityMul = (rarity.mul || 1) * powerScale;
    const proc = {
      key: def.key,
      name: def.name,
      trigger: def.trigger,
      chance: clamp(rollInRange(def.chance, qualityMul), 0.04, 0.9),
      cooldown: Math.max(0.3, randFloat(def.cooldown[0], def.cooldown[1]) / (1 + (qualityMul - 1) * 0.45)),
      power: def.power ? rollInRange(def.power, qualityMul) : 0,
      slot,
    };

    if (def.radius) proc.radius = Math.floor(rollInRange(def.radius, qualityMul));
    if (def.bounces) proc.bounces = Math.max(1, Math.floor(rollInRange(def.bounces, qualityMul)));
    if (def.count) proc.count = Math.max(1, Math.floor(rollInRange(def.count, qualityMul)));
    if (def.threshold) proc.threshold = clamp(rollInRange(def.threshold, qualityMul), 0.1, 0.5);
    if (def.heal) proc.heal = Math.floor(rollInRange(def.heal, qualityMul));
    if (def.speedMul) proc.speedMul = rollInRange(def.speedMul, qualityMul);
    if (def.damageMul) proc.damageMul = rollInRange(def.damageMul, qualityMul);
    if (def.duration) proc.duration = rollInRange(def.duration, qualityMul);
    if (def.bolts) proc.bolts = Math.max(4, Math.floor(rollInRange(def.bolts, qualityMul)));
    if (def.shield) proc.shield = Math.floor(rollInRange(def.shield, qualityMul));
    if (def.slow) proc.slow = clamp(rollInRange(def.slow, qualityMul), 0.4, 0.95);
    if (def.slowDuration) proc.slowDuration = rollInRange(def.slowDuration, qualityMul);
    if (def.skillRefund) proc.skillRefund = clamp(rollInRange(def.skillRefund, qualityMul), 0.15, 0.95);
    if (def.rollRefund) proc.rollRefund = clamp(rollInRange(def.rollRefund, qualityMul), 0.1, 0.95);
    if (def.gold) proc.gold = Math.max(1, Math.floor(rollInRange(def.gold, qualityMul)));
    if (def.xp) proc.xp = Math.max(1, Math.floor(rollInRange(def.xp, qualityMul)));

    return proc;
  }

  function makeRandomPowers(slot, rarity, powerScale) {
    const count = rollProcCount(rarity, powerScale);
    if (count <= 0) return [];

    const picks = [];
    const used = new Set();
    const filtered = POWER_DEFS.filter((p) => p.slots.includes(slot));
    for (let i = 0; i < count; i += 1) {
      const p = pickWeighted(filtered, used);
      if (!p) break;
      used.add(p.key);
      picks.push(makePower(p, slot, rarity, powerScale));
    }

    return picks;
  }

  function pickRarity(options) {
    const opts = options || {};
    const minIndex = Math.max(0, rarityIndex(opts.minRarity));
    const pool = ITEM_RARITY.slice(minIndex);
    const rarityBoost = clamp(opts.rarityBoost || 0, 0, 2.5);
    const weightedPool = pool.map((rarity, i) => ({
      rarity,
      weight: rarity.weight * (1 + rarityBoost * i),
    }));

    const total = weightedPool.reduce((acc, r) => acc + r.weight, 0);
    let roll = Math.random() * total;
    for (const rarity of weightedPool) {
      roll -= rarity.weight;
      if (roll <= 0) return rarity.rarity;
    }
    return weightedPool[0] ? weightedPool[0].rarity : ITEM_RARITY[0];
  }

  function makeRandomItem(options) {
    const opts = options || {};
    const growth = getGrowthForLevel(opts.levelIndex);
    const minRarity = higherRarityKey(growth.minRarity, opts.minRarity);
    const statScale = growth.statScale * Math.max(0.2, opts.statScale || 1);
    const powerScale = growth.powerScale * Math.max(0.2, opts.powerScale || 1);
    const rarityBoost = growth.rarityBoost + Math.max(0, opts.rarityBoost || 0);
    const slot = SLOT_KEYS[randInt(0, SLOT_KEYS.length)];
    const prefix = ITEM_PREFIX[slot][randInt(0, ITEM_PREFIX[slot].length)];
    const rarity = pickRarity({ minRarity, rarityBoost });
    const qualityMul = rarity.mul * statScale;
    const bonuses = {};

    if (slot === "weapon") {
      bonuses.damage = Math.floor(randInt(4, 11) * qualityMul);
      if (Math.random() < 0.35) bonuses.attackCooldown = -randFloat(0.02, 0.06) * qualityMul;
      if (Math.random() < 0.5) bonuses.critChance = randFloat(0.02, 0.08) * qualityMul;
    } else if (slot === "armor") {
      bonuses.maxHp = Math.floor(randInt(12, 36) * qualityMul);
      if (Math.random() < 0.8) bonuses.defense = randFloat(0.02, 0.08) * qualityMul;
    } else if (slot === "boots") {
      bonuses.speed = Math.floor(randInt(10, 26) * qualityMul);
      if (Math.random() < 0.3) bonuses.rollDuration = -randFloat(0.02, 0.06) * qualityMul;
      if (Math.random() < 0.4) bonuses.skillHaste = randFloat(0.03, 0.1) * qualityMul;
    } else {
      bonuses.damage = Math.floor(randInt(2, 8) * qualityMul);
      if (Math.random() < 0.5) bonuses.maxHp = Math.floor(randInt(6, 16) * qualityMul);
      if (Math.random() < 0.2) bonuses.speed = Math.floor(randInt(4, 14) * qualityMul);
      if (Math.random() < 0.45) bonuses.lifeSteal = randFloat(0.01, 0.05) * qualityMul;
      if (Math.random() < 0.45) bonuses.critDamage = randFloat(0.05, 0.2) * qualityMul;
    }

    return {
      slot,
      name: `${prefix}${SLOT_LABELS[slot]}`,
      rarity,
      bonuses,
      powers: makeRandomPowers(slot, rarity, powerScale),
    };
  }

  function equipmentScore(item) {
    if (!item) return -Infinity;
    const b = item.bonuses || {};

    return (
      (b.damage || 0) * 1.5 +
      (b.maxHp || 0) * 0.2 +
      (b.speed || 0) * 0.15 +
      (b.projectileSpeed || 0) * 0.06 +
      (b.critChance || 0) * 120 +
      (b.critDamage || 0) * 90 +
      (b.lifeSteal || 0) * 140 +
      (b.defense || 0) * 130 +
      (b.skillHaste || 0) * 100 +
      ((b.attackCooldown || 0) < 0 ? Math.abs(b.attackCooldown) * 120 : 0) +
      ((b.rollDuration || 0) < 0 ? Math.abs(b.rollDuration) * 70 : 0) +
      (item.powers || []).reduce((acc, p) => acc + p.chance * 180 + (1 / Math.max(0.3, p.cooldown)) * 70 + (p.power || 0) * 120, 0)
    );
  }

  function formatBonus(key, value) {
    if (key === "attackCooldown" || key === "rollDuration") {
      const sign = value < 0 ? "-" : "+";
      return `${sign}${Math.abs(value).toFixed(2)}\u79D2`;
    }
    if (key === "critChance" || key === "lifeSteal" || key === "defense" || key === "skillHaste") {
      return `${(value * 100).toFixed(1)}%`;
    }
    if (key === "critDamage") {
      return `+${(value * 100).toFixed(1)}%`;
    }
    return `${value > 0 ? "+" : ""}${Math.round(value)}`;
  }

  function bonusLabel(key) {
    const map = {
      maxHp: "\u751F\u547D",
      speed: "\u79FB\u901F",
      damage: "\u653B\u51FB",
      projectileSpeed: "\u5F39\u901F",
      attackCooldown: "\u653B\u901F",
      rollDuration: "\u7FFB\u6EDA\u65F6\u957F",
      critChance: "\u66B4\u51FB\u7387",
      critDamage: "\u66B4\u51FB\u4F24\u5BB3",
      lifeSteal: "\u5438\u8840",
      defense: "\u51CF\u4F24",
      skillHaste: "\u6280\u80FD\u6025\u901F",
    };
    return map[key] || key;
  }

  function formatPower(power) {
    if (!power) return "";
    const chance = `${Math.round(power.chance * 100)}%`;
    const cd = `${power.cooldown.toFixed(1)}s`;
    const triggerName = {
      onHit: "\u547D\u4E2D",
      onKill: "\u51FB\u6740",
      onDamaged: "\u53D7\u51FB",
      onCrit: "\u66B4\u51FB",
      onSkill: "\u653E\u6280\u80FD",
    }[power.trigger] || power.trigger;

    let detail = "";
    if (power.key === "chain") detail = `\u8FDE\u9501${power.bounces}\u6B21`;
    else if (power.key === "nova") detail = `\u8303\u56F4${power.radius}`;
    else if (power.key === "execution") detail = `\u65A9\u6740\u7EBF${Math.round(power.threshold * 100)}%`;
    else if (power.key === "shadow_shot") detail = `${power.count}\u98DE\u5203`;
    else if (power.key === "blood_rush") detail = `\u6301\u7EED${power.duration.toFixed(1)}s`;
    else if (power.key === "arcane_ring") detail = `${power.bolts}\u661F\u5F39`;
    else if (power.key === "barrier") detail = `\u62A4\u76FE${power.shield}`;
    else if (power.key === "frost_guard") detail = `\u51CF\u901F${Math.round(power.slow * 100)}%`;
    else if (power.key === "time_warp") detail = `\u56DE\u6EAF`;
    else if (power.key === "meteor") detail = `\u7206\u70B8${power.radius}`;
    else if (power.key === "echo") detail = `\u56DE\u54CD${power.duration.toFixed(1)}s`;
    else if (power.key === "lucky_star") detail = `\u91D1\u5E01\u7ECF\u9A8C`;

    return `${power.name}(${triggerName}/${chance}/CD${cd}${detail ? `/${detail}` : ""})`;
  }

  CG.EquipmentSystem = {
    makeStarterItem,
    makeBasicItem,
    makeRandomItem,
    equipmentScore,
    formatBonus,
    bonusLabel,
    formatPower,
  };
})();
