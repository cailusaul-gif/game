(() => {
  const CG = (window.CoopGame = window.CoopGame || {});
  const { CLASS_DEFS, SLOT_KEYS, SKILL_DEFS } = CG.CONSTANTS;
  const { clamp, normalize } = CG.Utils;

  class Player extends CG.Entity {
    constructor(id, classKey, controls, x, y) {
      super(x, y, 14);
      this.id = id;
      this.classKey = classKey;
      this.controls = controls;
      this.base = { ...CLASS_DEFS[classKey] };
      this.skillDef = SKILL_DEFS[classKey];

      this.equipment = {
        weapon: CG.EquipmentSystem.makeStarterItem(classKey),
        armor: CG.EquipmentSystem.makeBasicItem("armor"),
        boots: CG.EquipmentSystem.makeBasicItem("boots"),
        accessory: CG.EquipmentSystem.makeBasicItem("accessory"),
      };

      this.stats = null;
      this.hp = 1;
      this.attackTimer = 0;
      this.rollTimer = 0;
      this.rollCooldown = 0;
      this.skillTimer = 0;
      this.invincible = false;
      this.lastAim = { x: id === "P1" ? 1 : -1, y: 0 };

      this.level = 1;
      this.xp = 0;
      this.xpToNext = 45;
      this.gold = 0;
      this.maxHealsPerRun = 2;
      this.potions = this.maxHealsPerRun;
      this.kills = 0;
      this.inventorySize = 8;
      this.inventory = [];
      this.inventoryCursor = 0;
      this.spriteMoving = false;
      this.spriteFacing = this.lastAim.x >= 0 ? 1 : -1;
      this.spriteAttackTimer = 0;
      this.spriteAttackDuration = 0.22;
      this.spriteHurtTimer = 0;
      this.spriteHurtDuration = 0.2;
      this.spriteScale = 0.086;
      this.spriteYOffset = 8;
      this.spriteSeed = Math.random() * 10;
      this.procCooldowns = {};
      this.damageBuffTimer = 0;
      this.damageBuffMul = 1;
      this.speedBuffTimer = 0;
      this.speedBuffMul = 1;
      this.echoBuffTimer = 0;
      this.echoBuffPower = 0;
      this.barrierTimer = 0;
      this.barrierValue = 0;
      this.slowTimer = 0;
      this.slowMul = 1;

      this.recalculateStats();
      this.hp = this.stats.maxHp;
    }

    recalculateStats() {
      const prevMax = this.stats ? this.stats.maxHp : this.base.maxHp;
      const next = {
        maxHp: this.base.maxHp,
        speed: this.base.speed,
        damage: this.base.damage,
        attackCooldown: this.base.attackCooldown,
        rollSpeed: this.base.rollSpeed,
        rollDuration: this.base.rollDuration,
        projectileSpeed: this.base.projectileSpeed || 0,
        defense: this.base.defense || 0,
        critChance: this.base.critChance || 0,
        critDamage: this.base.critDamage || 1.5,
        lifeSteal: this.base.lifeSteal || 0,
        skillHaste: 0,
      };

      for (const slot of SLOT_KEYS) {
        const bonuses = this.equipment[slot] ? this.equipment[slot].bonuses : null;
        if (!bonuses) continue;
        for (const [key, value] of Object.entries(bonuses)) {
          next[key] = (next[key] || 0) + value;
        }
      }

      next.attackCooldown = Math.max(0.08, next.attackCooldown);
      next.rollDuration = Math.max(0.1, next.rollDuration);
      next.defense = clamp(next.defense, 0, 0.75);
      next.critChance = clamp(next.critChance, 0, 0.85);
      next.critDamage = Math.max(1.2, next.critDamage);
      next.lifeSteal = clamp(next.lifeSteal, 0, 0.5);
      next.skillHaste = Math.max(0, next.skillHaste);

      this.stats = next;
      this.hp = clamp(this.hp + (next.maxHp - prevMax), 0, next.maxHp);
    }

    equip(item) {
      if (!item) return false;
      const existing = this.equipment[item.slot];
      const oldScore = CG.EquipmentSystem.equipmentScore(existing);
      const newScore = CG.EquipmentSystem.equipmentScore(item);
      if (newScore <= oldScore) return false;

      this.equipment[item.slot] = item;
      this.recalculateStats();
      return true;
    }

    gainXp(amount) {
      this.xp += amount;
      let leveled = 0;

      while (this.xp >= this.xpToNext) {
        this.xp -= this.xpToNext;
        this.level += 1;
        this.xpToNext = Math.floor(this.xpToNext * 1.26 + 12);
        this.base.maxHp += 8;
        this.base.damage += 2;
        this.base.speed += 1;
        leveled += 1;
      }

      if (leveled > 0) {
        this.recalculateStats();
        this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.3);
      }

      return leveled;
    }

    heal(amount) {
      this.hp = clamp(this.hp + amount, 0, this.stats.maxHp);
    }

    usePotion() {
      if (this.potions <= 0 || !this.alive) return false;
      this.potions -= 1;
      this.heal(this.stats.maxHp / 3);
      return true;
    }

    addPotion(count) {
      this.potions = Math.min(this.maxHealsPerRun, this.potions + count);
    }

    addGold(amount) {
      this.gold += amount;
    }

    normalizeInventoryCursor() {
      if (this.inventory.length <= 0) {
        this.inventoryCursor = 0;
        return;
      }
      if (this.inventoryCursor < 0) this.inventoryCursor = this.inventory.length - 1;
      if (this.inventoryCursor >= this.inventory.length) this.inventoryCursor = 0;
    }

    addToInventory(item) {
      if (!item) return false;
      if (this.inventory.length >= this.inventorySize) return false;
      this.inventory.push(item);
      this.normalizeInventoryCursor();
      return true;
    }

    selectInventory(step) {
      if (this.inventory.length <= 0) {
        this.inventoryCursor = 0;
        return;
      }
      this.inventoryCursor += step;
      this.normalizeInventoryCursor();
    }

    equipFromInventory(index) {
      if (this.inventory.length <= 0) {
        return { ok: false, reason: "背包为空" };
      }
      const idx = Math.max(0, Math.min(index, this.inventory.length - 1));
      const picked = this.inventory[idx];
      if (!picked) return { ok: false, reason: "未找到该装备" };

      const old = this.equipment[picked.slot];
      this.equipment[picked.slot] = picked;
      this.inventory.splice(idx, 1);
      if (old) this.inventory.splice(idx, 0, old);
      this.recalculateStats();
      this.normalizeInventoryCursor();

      return { ok: true, item: picked, replaced: old };
    }

    dropFromInventory(index, game) {
      if (!game) return { ok: false, reason: "游戏上下文缺失" };
      if (this.inventory.length <= 0) {
        return { ok: false, reason: "背包为空" };
      }

      const idx = Math.max(0, Math.min(index, this.inventory.length - 1));
      const item = this.inventory[idx];
      if (!item) return { ok: false, reason: "未找到该装备" };

      this.inventory.splice(idx, 1);
      this.normalizeInventoryCursor();
      return { ok: true, item };
    }

    getSkillCooldown() {
      return Math.max(1.8, this.skillDef.cooldown / (1 + this.stats.skillHaste));
    }

    getDamageOutput(base) {
      let mul = 1;
      if (this.damageBuffTimer > 0) mul *= this.damageBuffMul;
      if (this.echoBuffTimer > 0) mul *= 1 + this.echoBuffPower;
      return base * mul;
    }

    getMoveMul() {
      let mul = 1;
      if (this.speedBuffTimer > 0) mul *= this.speedBuffMul;
      if (this.slowTimer > 0) mul *= this.slowMul;
      return mul;
    }

    weaponVisualVariant() {
      const item = this.equipment?.weapon;
      if (!item) return 0;
      const text = `${item.name || ""}:${item.rarity?.key || "common"}`;
      let h = 0;
      for (let i = 0; i < text.length; i += 1) {
        h = (h * 33 + text.charCodeAt(i)) % 9973;
      }
      return h % 24;
    }

    weaponRarityKey() {
      return this.equipment?.weapon?.rarity?.key || "common";
    }

    weaponRarityTier() {
      const key = this.weaponRarityKey();
      if (key === "legendary") return 3;
      if (key === "epic") return 2;
      if (key === "rare") return 1;
      return 0;
    }

    weaponVisualPalette() {
      const rarityKey = this.weaponRarityKey();
      if (rarityKey === "legendary") {
        return {
          metal: "#fff1be",
          edge: "#ffd36d",
          core: "#ff944f",
          glow: "rgba(255,184,94,0.55)",
          cloth: "#ffb26e",
          spark: true,
        };
      }
      if (rarityKey === "epic") {
        return {
          metal: "#ecd8ff",
          edge: "#be93ff",
          core: "#7d5bcd",
          glow: "rgba(184,133,255,0.46)",
          cloth: "#9f7eff",
          spark: true,
        };
      }
      if (rarityKey === "rare") {
        return {
          metal: "#d8f2ff",
          edge: "#84d6ff",
          core: "#3a8fc8",
          glow: "rgba(122,207,255,0.35)",
          cloth: "#58a8d8",
          spark: false,
        };
      }
      return {
        metal: "#d8dee6",
        edge: "#bfc7d0",
        core: "#8490a0",
        glow: "rgba(180,190,202,0.22)",
        cloth: "#8c98a8",
        spark: false,
      };
    }

    drawEquipmentOverlay(ctx) {
      const palette = this.weaponVisualPalette();
      const tier = this.weaponRarityTier();
      const t = performance.now() * 0.004 + this.spriteSeed;
      const pulse = 1 + Math.sin(t) * 0.03;

      ctx.save();
      ctx.translate(this.x, this.y + (this.spriteYOffset || 0) - 2);
      ctx.scale(pulse, pulse);

      if (tier >= 1) {
        ctx.strokeStyle = palette.glow;
        ctx.lineWidth = 2 + tier * 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 4 + tier, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = palette.cloth;
      ctx.globalAlpha = 0.76;
      ctx.beginPath();
      ctx.moveTo(-6, -7);
      ctx.lineTo(-2, -11);
      ctx.lineTo(2, -11);
      ctx.lineTo(6, -7);
      ctx.lineTo(5, -1);
      ctx.lineTo(-5, -1);
      ctx.closePath();
      ctx.fill();

      if (tier >= 2) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = palette.glow;
        ctx.beginPath();
        ctx.moveTo(-5, 2);
        ctx.lineTo(0, 13 + tier * 1.5);
        ctx.lineTo(5, 2);
        ctx.closePath();
        ctx.fill();
      }

      if (tier >= 3) {
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = palette.edge;
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 3; i += 1) {
          const a = t * 1.2 + (Math.PI * 2 * i) / 3;
          const x = Math.cos(a) * (this.radius + 8);
          const y = Math.sin(a) * (this.radius + 6);
          ctx.beginPath();
          ctx.arc(x, y, 1.3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    drawWeaponModel(ctx) {
      const item = this.equipment?.weapon;
      if (!item) return;
      const palette = this.weaponVisualPalette();
      const variant = this.weaponVisualVariant();
      const tier = this.weaponRarityTier();
      const facing = this.spriteFacing || 1;
      const swing = this.spriteAttackTimer > 0 ? Math.sin((1 - this.spriteAttackTimer / Math.max(0.01, this.spriteAttackDuration)) * Math.PI) : 0;
      const baseAngle = Math.atan2(this.lastAim.y || 0, this.lastAim.x || facing);

      ctx.save();
      ctx.translate(this.x, this.y + (this.spriteYOffset || 0) - 3);
      ctx.rotate(baseAngle + facing * swing * (0.3 + tier * 0.05));

      if (this.classKey === "samurai") {
        const style = variant % 5;
        const len = 20 + (variant % 6) * 2 + tier * 2;
        const bladeW = 2.6 + (variant % 3) * 0.6;
        ctx.shadowColor = palette.glow;
        ctx.shadowBlur = 8 + (variant % 3) * 2 + tier * 2;
        ctx.fillStyle = style === 4 ? palette.edge : palette.metal;
        ctx.fillRect(-2, -bladeW * 0.5, len, bladeW + (style === 1 ? 1 : 0));
        ctx.strokeStyle = style === 2 ? palette.core : palette.edge;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-2, -bladeW * 0.5, len, bladeW + (style === 1 ? 1 : 0));
        ctx.fillStyle = palette.core;
        ctx.fillRect(-4, -2.5, 3.5, 5);
        ctx.fillRect(-6.5, -1.4, 2.8, 2.8);

        if (style === 0 || style === 3) {
          ctx.fillStyle = palette.edge;
          ctx.beginPath();
          ctx.moveTo(len + 1.5, 0);
          ctx.lineTo(len - 2, -2.4 - tier * 0.3);
          ctx.lineTo(len - 2, 2.4 + tier * 0.3);
          ctx.closePath();
          ctx.fill();
        }
        if (style === 1 || style === 4) {
          ctx.strokeStyle = palette.glow;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(len * 0.3, -2.4);
          ctx.lineTo(len * 0.8, -2.4 - tier * 0.4);
          ctx.moveTo(len * 0.3, 2.4);
          ctx.lineTo(len * 0.8, 2.4 + tier * 0.4);
          ctx.stroke();
        }
        if (style === 2) {
          ctx.fillStyle = palette.edge;
          ctx.beginPath();
          ctx.moveTo(len * 0.5, 0);
          ctx.lineTo(len * 0.38, -2.2);
          ctx.lineTo(len * 0.38, 2.2);
          ctx.closePath();
          ctx.fill();
        }
      } else if (this.classKey === "archer") {
        const style = variant % 6;
        const r = 10 + (variant % 6) + tier * 1.5;
        ctx.shadowColor = palette.glow;
        ctx.shadowBlur = 7 + (variant % 2) * 2 + tier * 2;
        ctx.strokeStyle = palette.edge;
        ctx.lineWidth = style === 5 ? 2.8 : 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, r, -1.2, 1.2);
        ctx.stroke();
        if (style === 2 || style === 5) {
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.72, -1.15, 1.15);
          ctx.stroke();
        }
        ctx.strokeStyle = "#f6f0dc";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(r * Math.cos(-1.2), r * Math.sin(-1.2));
        ctx.lineTo(r * Math.cos(1.2), r * Math.sin(1.2));
        ctx.stroke();
        ctx.fillStyle = palette.core;
        ctx.beginPath();
        ctx.arc(0, 0, 2.2 + (style === 4 ? 0.8 : 0), 0, Math.PI * 2);
        ctx.fill();
        if (style >= 3) {
          ctx.fillStyle = palette.metal;
          ctx.beginPath();
          ctx.arc(-r * 0.65, 0, 1.3, 0, Math.PI * 2);
          ctx.arc(r * 0.65, 0, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const style = variant % 6;
        const len = 18 + (variant % 5) * 2 + tier * 1.8;
        ctx.shadowColor = palette.glow;
        ctx.shadowBlur = 8 + tier * 2;
        ctx.fillStyle = "#8a6b4d";
        ctx.fillRect(-1.3, -1.3, len * 0.75, 2.6);
        ctx.fillStyle = palette.edge;
        const tipKind = style;
        if (tipKind === 0) {
          ctx.beginPath();
          ctx.arc(len * 0.78, 0, 4.4 + tier * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (tipKind === 1) {
          ctx.beginPath();
          ctx.moveTo(len * 0.78, -5);
          ctx.lineTo(len * 0.78 + 4, 0);
          ctx.lineTo(len * 0.78, 5);
          ctx.lineTo(len * 0.78 - 4, 0);
          ctx.closePath();
          ctx.fill();
        } else if (tipKind === 2) {
          ctx.beginPath();
          ctx.arc(len * 0.78, 0, 4.8 + tier * 0.5, 0, Math.PI * 2);
          ctx.strokeStyle = palette.metal;
          ctx.lineWidth = 1.3;
          ctx.stroke();
        } else if (tipKind === 3) {
          ctx.beginPath();
          ctx.arc(len * 0.78, 0, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = palette.metal;
          ctx.lineWidth = 1;
          for (let i = 0; i < 3; i += 1) {
            const a = (Math.PI * 2 * i) / 3 + performance.now() * 0.005;
            ctx.beginPath();
            ctx.moveTo(len * 0.78, 0);
            ctx.lineTo(len * 0.78 + Math.cos(a) * 5.8, Math.sin(a) * 5.8);
            ctx.stroke();
          }
        } else if (tipKind === 4) {
          ctx.strokeStyle = palette.edge;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(len * 0.78, 0, 6.4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = palette.core;
          ctx.beginPath();
          ctx.arc(len * 0.78, 0, 2.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = palette.edge;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(len * 0.7, -5.6);
          ctx.lineTo(len * 0.88, 0);
          ctx.lineTo(len * 0.7, 5.6);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(len * 0.7, 0, 2.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (palette.spark) {
        ctx.fillStyle = "rgba(255,250,220,0.78)";
        const count = 2 + tier;
        for (let i = 0; i < count; i += 1) {
          const a = performance.now() * 0.004 + i * Math.PI;
          const sx = Math.cos(a) * (7 + tier);
          const sy = Math.sin(a) * (5 + tier * 0.6);
          ctx.beginPath();
          ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    allPowers() {
      const powers = [];
      for (const slot of SLOT_KEYS) {
        const item = this.equipment[slot];
        if (!item || !Array.isArray(item.powers)) continue;
        for (let i = 0; i < item.powers.length; i += 1) {
          powers.push({ slot, index: i, power: item.powers[i] });
        }
      }
      return powers;
    }

    tickProcState(dt) {
      for (const key of Object.keys(this.procCooldowns)) {
        this.procCooldowns[key] -= dt;
        if (this.procCooldowns[key] <= 0) {
          delete this.procCooldowns[key];
        }
      }

      this.damageBuffTimer = Math.max(0, this.damageBuffTimer - dt);
      if (this.damageBuffTimer <= 0) this.damageBuffMul = 1;
      this.speedBuffTimer = Math.max(0, this.speedBuffTimer - dt);
      if (this.speedBuffTimer <= 0) this.speedBuffMul = 1;
      this.echoBuffTimer = Math.max(0, this.echoBuffTimer - dt);
      if (this.echoBuffTimer <= 0) this.echoBuffPower = 0;
      this.barrierTimer = Math.max(0, this.barrierTimer - dt);
      if (this.barrierTimer <= 0) this.barrierValue = 0;
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      if (this.slowTimer <= 0) this.slowMul = 1;
    }

    tryTriggerPowers(trigger, game, ctx) {
      if (!game) return;
      const hasteMul = 1 + this.stats.skillHaste * 0.45;
      for (const entry of this.allPowers()) {
        const power = entry.power;
        if (!power || power.trigger !== trigger) continue;
        const key = `${entry.slot}:${entry.index}:${power.key}`;
        if ((this.procCooldowns[key] || 0) > 0) continue;

        const chance = clamp(power.chance * hasteMul, 0.01, 0.95);
        if (Math.random() > chance) continue;
        this.procCooldowns[key] = Math.max(0.25, power.cooldown || 1);
        this.activatePower(power, game, ctx || {});
      }
    }

    activatePower(power, game, ctx) {
      if (power.key === "chain") {
        const hit = new Set();
        let from = ctx.enemy || null;
        if (!from) return;
        hit.add(from);
        for (let b = 0; b < (power.bounces || 2); b += 1) {
          let best = null;
          let bestDist = Infinity;
          for (const enemy of game.enemies) {
            if (!enemy.alive || hit.has(enemy)) continue;
            const d = Math.hypot(enemy.x - from.x, enemy.y - from.y);
            if (d <= (power.radius || 120) && d < bestDist) {
              best = enemy;
              bestDist = d;
            }
          }
          if (!best) break;
          hit.add(best);
          from = best;
          this.dealDamage(best, this.getDamageOutput(this.stats.damage * (power.power || 0.6)), game, {
            forceCrit: false,
            noLifesteal: true,
            isProc: true,
          });
          game.effects.push({
            kind: "chain_lightning",
            x: best.x,
            y: best.y,
            r: best.radius + 8,
            t: 0.08,
            color: "rgba(140,220,255,0.5)",
          });
        }
        return;
      }

      if (power.key === "nova") {
        const center = ctx.enemy || this;
        for (const enemy of game.enemies) {
          if (!enemy.alive) continue;
          const d = Math.hypot(enemy.x - center.x, enemy.y - center.y);
          if (d > (power.radius || 64) + enemy.radius) continue;
          this.dealDamage(enemy, this.getDamageOutput(this.stats.damage * (power.power || 0.7)), game, {
            noLifesteal: true,
            isProc: true,
          });
        }
        game.effects.push({
          kind: "nova_ring",
          x: center.x,
          y: center.y,
          r: power.radius || 64,
          t: 0.18,
          color: "rgba(255,132,97,0.45)",
        });
        return;
      }

      if (power.key === "execution") {
        const enemy = ctx.enemy;
        if (!enemy || !enemy.alive) return;
        const ratio = enemy.hp / Math.max(1, enemy.maxHp);
        if (ratio > (power.threshold || 0.22)) return;
        this.dealDamage(enemy, this.getDamageOutput(this.stats.damage * (power.power || 0.3)), game, {
          forceCrit: true,
          noLifesteal: true,
          isProc: true,
        });
        return;
      }

      if (power.key === "shadow_shot") {
        const aim = normalize(this.lastAim.x, this.lastAim.y);
        if (!aim) return;
        const count = Math.max(1, power.count || 2);
        const spread = 0.32;
        for (let i = 0; i < count; i += 1) {
          const delta = ((i / Math.max(1, count - 1)) - 0.5) * spread;
          const ca = Math.cos(delta);
          const sa = Math.sin(delta);
          const vx = (aim.x * ca - aim.y * sa) * Math.max(260, this.stats.projectileSpeed || 320);
          const vy = (aim.x * sa + aim.y * ca) * Math.max(260, this.stats.projectileSpeed || 320);
          game.projectiles.push(
            new CG.Projectile(this.x, this.y, vx, vy, {
              owner: "player",
              damage: this.getDamageOutput(this.stats.damage * (power.power || 0.75)),
              radius: 4,
              ttl: 1.2,
              color: "#b38cff",
              sourcePlayer: this,
              isProc: true,
              visual: "shadow_blade",
              trailColor: "rgba(190,145,255,0.65)",
            })
          );
        }
        return;
      }

      if (power.key === "blood_rush") {
        this.heal(power.heal || 12);
        this.damageBuffMul = Math.max(this.damageBuffMul, power.damageMul || 1.12);
        this.speedBuffMul = Math.max(this.speedBuffMul, power.speedMul || 1.12);
        this.damageBuffTimer = Math.max(this.damageBuffTimer, power.duration || 2.4);
        this.speedBuffTimer = Math.max(this.speedBuffTimer, power.duration || 2.4);
        game.effects.push({
          kind: "blood_aura",
          x: this.x,
          y: this.y,
          r: this.radius + 20,
          t: 0.2,
          color: "rgba(255,90,120,0.4)",
        });
        return;
      }

      if (power.key === "arcane_ring") {
        const bolts = Math.max(4, power.bolts || 8);
        const speed = Math.max(220, this.stats.projectileSpeed || 320);
        for (let i = 0; i < bolts; i += 1) {
          const a = (Math.PI * 2 * i) / bolts;
          game.projectiles.push(
            new CG.Projectile(this.x, this.y, Math.cos(a) * speed, Math.sin(a) * speed, {
              owner: "player",
              damage: this.getDamageOutput(this.stats.damage * (power.power || 0.55)),
              radius: 5,
              ttl: 1.2,
              color: "#8fd3ff",
              sourcePlayer: this,
              noLifesteal: true,
              isProc: true,
              visual: "arcane_orb",
              trailColor: "rgba(149,226,255,0.7)",
            })
          );
        }
        return;
      }

      if (power.key === "barrier") {
        this.barrierValue += power.shield || 24;
        this.barrierTimer = Math.max(this.barrierTimer, power.duration || 3.2);
        return;
      }

      if (power.key === "frost_guard") {
        const radius = power.radius || 90;
        for (const enemy of game.enemies) {
          if (!enemy.alive) continue;
          const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
          if (d > radius + enemy.radius) continue;
          this.dealDamage(enemy, this.getDamageOutput(this.stats.damage * (power.power || 0.7)), game, {
            noLifesteal: true,
            isProc: true,
          });
          if (typeof enemy.applySlow === "function") {
            enemy.applySlow(power.slow || 0.72, power.slowDuration || 1.8);
          }
        }
        game.effects.push({
          kind: "frost_guard",
          x: this.x,
          y: this.y,
          r: radius,
          t: 0.18,
          color: "rgba(137,196,255,0.42)",
        });
        return;
      }

      if (power.key === "time_warp") {
        this.skillTimer = Math.max(0, this.skillTimer - this.getSkillCooldown() * (power.skillRefund || 0.45));
        this.rollCooldown = Math.max(0, this.rollCooldown - 0.8 * (power.rollRefund || 0.35));
        return;
      }

      if (power.key === "meteor") {
        const center = ctx.enemy || this;
        const radius = power.radius || 70;
        for (const enemy of game.enemies) {
          if (!enemy.alive) continue;
          const d = Math.hypot(enemy.x - center.x, enemy.y - center.y);
          if (d <= radius + enemy.radius) {
            this.dealDamage(enemy, this.getDamageOutput(this.stats.damage * (power.power || 0.95)), game, {
              noLifesteal: true,
              isProc: true,
            });
          }
        }
        game.effects.push({
          kind: "meteor_blast",
          x: center.x,
          y: center.y,
          r: radius,
          t: 0.18,
          color: "rgba(255,106,69,0.52)",
        });
        return;
      }

      if (power.key === "echo") {
        this.echoBuffPower = Math.max(this.echoBuffPower, power.power || 0.28);
        this.echoBuffTimer = Math.max(this.echoBuffTimer, power.duration || 3.2);
        return;
      }

      if (power.key === "lucky_star") {
        this.addGold(power.gold || 1);
        this.gainXp(power.xp || 1);
      }
    }

    takeDamage(amount, options) {
      const opts = options || {};
      if (!this.alive || this.invincible) return 0;
      const reduced = opts.ignoreDefense ? amount : amount * (1 - this.stats.defense);
      let finalDamage = Math.max(0, reduced);

      if (this.barrierTimer > 0 && this.barrierValue > 0 && finalDamage > 0) {
        const absorbed = Math.min(this.barrierValue, finalDamage);
        this.barrierValue -= absorbed;
        finalDamage -= absorbed;
      }

      if (finalDamage <= 0) return 0;
      this.hp -= finalDamage;
      this.spriteHurtTimer = this.spriteHurtDuration;

      if (opts.sourceEnemy && opts.sourceEnemy.hitSlow) {
        const debuff = opts.sourceEnemy.hitSlow;
        this.slowTimer = Math.max(this.slowTimer, debuff.duration || 1.2);
        this.slowMul = Math.min(this.slowMul, debuff.mul || 0.8);
      }

      if (!opts.noProc) {
        this.tryTriggerPowers("onDamaged", opts.game || null, {
          sourceEnemy: opts.sourceEnemy || null,
          damage: finalDamage,
        });
      }

      if (this.hp <= 0) {
        this.hp = 0;
        this.alive = false;
      }

      return finalDamage;
    }

    dealDamage(enemy, baseDamage, game, options) {
      if (!enemy || !enemy.alive) return 0;
      const opts = options || {};
      const wasAlive = enemy.alive;
      const crit = opts.forceCrit || Math.random() < this.stats.critChance;
      const bonus = crit ? this.stats.critDamage : 1;
      const amount = Math.max(1, Math.floor(baseDamage * bonus));
      const dealt = enemy.takeDamage(amount, { attacker: this, game });

      if (dealt > 0 && !opts.noLifesteal) {
        this.heal(dealt * this.stats.lifeSteal);
      }

      if (crit && !opts.isProc) {
        game.effects.push({
          kind: "crit",
          x: enemy.x,
          y: enemy.y,
          r: enemy.radius + 10,
          t: 0.12,
          color: "rgba(255,215,64,0.55)",
        });
      }

      if (dealt > 0 && !opts.isProc) {
        this.tryTriggerPowers("onHit", game, { enemy, damage: dealt, crit });
        if (crit) this.tryTriggerPowers("onCrit", game, { enemy, damage: dealt });
        if (wasAlive && !enemy.alive) {
          this.tryTriggerPowers("onKill", game, { enemy, damage: dealt });
        }
      }

      return dealt;
    }

    update(dt, input, game) {
      if (!this.alive) return;

      this.tickProcState(dt);
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      this.rollCooldown = Math.max(0, this.rollCooldown - dt);
      this.skillTimer = Math.max(0, this.skillTimer - dt);
      this.spriteAttackTimer = Math.max(0, this.spriteAttackTimer - dt);
      this.spriteHurtTimer = Math.max(0, this.spriteHurtTimer - dt);
      this.spriteMoving = false;
      const moveMul = this.getMoveMul();

      let mx = 0;
      let my = 0;
      if (input.isDown(this.controls.left)) mx -= 1;
      if (input.isDown(this.controls.right)) mx += 1;
      if (input.isDown(this.controls.up)) my -= 1;
      if (input.isDown(this.controls.down)) my += 1;

      const hasMove = mx !== 0 || my !== 0;
      if (hasMove) {
        const len = Math.hypot(mx, my);
        mx /= len;
        my /= len;
        this.lastAim.x = mx;
        this.lastAim.y = my;
        this.spriteFacing = this.lastAim.x >= 0 ? 1 : -1;
      }

      if (this.rollTimer > 0) {
        this.rollTimer -= dt;
        this.invincible = true;
        this.spriteMoving = true;
        const rollMul = Math.max(0.75, moveMul);
        game.moveEntity(
          this,
          this.lastAim.x * this.stats.rollSpeed * rollMul * dt,
          this.lastAim.y * this.stats.rollSpeed * rollMul * dt
        );
        if (this.rollTimer <= 0) {
          this.rollTimer = 0;
          this.invincible = false;
        }
      } else {
        if (input.consume(this.controls.roll) && hasMove && this.rollCooldown <= 0) {
          this.rollTimer = this.stats.rollDuration;
          this.rollCooldown = 0.8;
        } else {
          if (hasMove) this.spriteMoving = true;
          game.moveEntity(this, mx * this.stats.speed * moveMul * dt, my * this.stats.speed * moveMul * dt);
        }

        if (input.consume(this.controls.attack) && this.attackTimer <= 0) {
          const atkSpeedMul = this.echoBuffTimer > 0 ? 1 + this.echoBuffPower * 0.45 : 1;
          this.attackTimer = this.stats.attackCooldown / atkSpeedMul;
          this.attack(game);
        }

        if (input.consume(this.controls.skill) && this.skillTimer <= 0) {
          this.castSkill(game);
          this.skillTimer = this.getSkillCooldown();
        }

        if (input.consume(this.controls.potion)) {
          if (this.usePotion()) {
            game.log = `${this.id} 使用了治疗（回复最大生命1/3）`;
          } else {
            game.log = `${this.id} 本局治疗次数已用完`;
          }
        }

        if (input.consume(this.controls.bagPrev)) {
          this.selectInventory(-1);
        }
        if (input.consume(this.controls.bagNext)) {
          this.selectInventory(1);
        }
        if (input.consume(this.controls.bagEquip)) {
          const result = this.equipFromInventory(this.inventoryCursor);
          if (!result.ok) {
            game.log = `${this.id} ${result.reason}`;
          } else {
            const rarityName = result.item?.rarity?.name || "普通";
            game.log = `${this.id} 从背包装备了[${rarityName}] ${result.item.name}`;
          }
        }

        if (input.consume(this.controls.bagDrop)) {
          const result = this.dropFromInventory(this.inventoryCursor, game);
          if (!result.ok) {
            game.log = `${this.id} ${result.reason}`;
          } else {
            const rarityName = result.item?.rarity?.name || "普通";
            game.log = `${this.id} 丢弃了[${rarityName}] ${result.item.name}`;
          }
        }
      }
    }

    castSkill(game) {
      this.spriteAttackDuration = 0.34;
      this.spriteAttackTimer = this.spriteAttackDuration;
      const tier = this.weaponRarityTier();
      const rarityKey = this.weaponRarityKey();
      if (this.classKey === "samurai") {
        const radius = 96 + tier * 10;
        for (const enemy of game.enemies) {
          if (!enemy.alive) continue;
          if (Math.hypot(enemy.x - this.x, enemy.y - this.y) <= radius + enemy.radius) {
            this.dealDamage(enemy, this.getDamageOutput(this.stats.damage * (1.58 + tier * 0.11)), game, { forceCrit: true });
          }
        }

        game.effects.push({
          kind: "samurai_skill",
          x: this.x,
          y: this.y,
          r: radius,
          t: 0.22,
          color: "rgba(255,140,102,0.55)",
          dirX: this.lastAim.x,
          dirY: this.lastAim.y,
        });
        game.effects.push({
          kind: "samurai_bloom",
          x: this.x,
          y: this.y,
          r: radius * 0.78,
          t: 0.22,
          color: tier >= 2 ? "rgba(244,162,255,0.46)" : "rgba(255,227,176,0.45)",
        });
        const petals = 8 + tier * 2;
        const slashVisual = tier >= 3 ? "boss_scythe" : tier >= 2 ? "shadow_blade" : "blade_wave";
        for (let i = 0; i < petals; i += 1) {
          const a = (Math.PI * 2 * i) / petals;
          game.projectiles.push(
            new CG.Projectile(this.x, this.y, Math.cos(a) * 320, Math.sin(a) * 320, {
              owner: "player",
              damage: this.getDamageOutput(this.stats.damage * (0.3 + tier * 0.05)),
              radius: 4,
              ttl: 0.38 + tier * 0.04,
              color: "#e9f7ff",
              sourcePlayer: this,
              noLifesteal: true,
              isProc: true,
              visual: slashVisual,
              trailColor: tier >= 2 ? "rgba(232,176,255,0.5)" : "rgba(188,234,255,0.45)",
            })
          );
        }
        this.tryTriggerPowers("onSkill", game, { classKey: this.classKey });
        game.log = `${this.id} 释放技能【${this.skillDef.name}】`;
        return;
      }

      const aim = normalize(this.lastAim.x, this.lastAim.y);
      if (!aim) return;

      if (this.classKey === "archer") {
        const count = 3 + tier;
        const spread = 0.42 + tier * 0.07;
        const arrowVisual = tier >= 3 ? "star_lance" : tier >= 2 ? "boss_lance" : tier >= 1 ? "arrow" : "arrow";
        for (let i = 0; i < count; i += 1) {
          const t = count === 1 ? 0.5 : i / (count - 1);
          const d = (t - 0.5) * spread;
          const ca = Math.cos(d);
          const sa = Math.sin(d);
          const dirX = aim.x * ca - aim.y * sa;
          const dirY = aim.x * sa + aim.y * ca;
          game.projectiles.push(
            new CG.Projectile(this.x, this.y, dirX * this.stats.projectileSpeed * (1 + tier * 0.05), dirY * this.stats.projectileSpeed * (1 + tier * 0.05), {
              owner: "player",
              damage: this.getDamageOutput(this.stats.damage * (1.02 + tier * 0.08)),
              radius: 5 + (tier >= 2 ? 1 : 0),
              ttl: 1.45 + tier * 0.06,
              color: "#b9ff7a",
              sourcePlayer: this,
              forceCrit: false,
              isProc: false,
              visual: arrowVisual,
              trailColor: tier >= 2 ? "rgba(216,171,255,0.55)" : "rgba(188,255,122,0.55)",
            })
          );
        }

        if (tier >= 2) {
          for (const side of [-0.34, 0.34]) {
            const ca = Math.cos(side);
            const sa = Math.sin(side);
            const dirX = aim.x * ca - aim.y * sa;
            const dirY = aim.x * sa + aim.y * ca;
            game.projectiles.push(
              new CG.Projectile(this.x, this.y, dirX * this.stats.projectileSpeed * 0.88, dirY * this.stats.projectileSpeed * 0.88, {
                owner: "player",
                damage: this.getDamageOutput(this.stats.damage * 0.55),
                radius: 4,
                ttl: 1.05,
                color: "#a8dfff",
                sourcePlayer: this,
                noLifesteal: true,
                isProc: true,
                visual: "rune_disc",
                trailColor: "rgba(171,220,255,0.55)",
              })
            );
          }
        }

        game.effects.push({
          kind: "arrow_fan",
          x: this.x,
          y: this.y,
          r: 86 + tier * 10,
          t: 0.2,
          color: tier >= 2 ? "rgba(202,166,255,0.45)" : "rgba(176,255,145,0.45)",
          dirX: aim.x,
          dirY: aim.y,
        });
        game.effects.push({
          kind: "arc_burst",
          x: this.x + aim.x * 22,
          y: this.y + aim.y * 22,
          r: 48 + tier * 8,
          t: 0.16,
          color: rarityKey === "legendary" ? "rgba(255,219,132,0.42)" : "rgba(182,255,160,0.36)",
        });
        this.tryTriggerPowers("onSkill", game, { classKey: this.classKey });
        game.log = `${this.id} 释放技能【${this.skillDef.name}】`;
        return;
      }

      if (this.classKey === "mage") {
        const radius = 132 + tier * 12;
        for (const enemy of game.enemies) {
          if (!enemy.alive) continue;
          if (Math.hypot(enemy.x - this.x, enemy.y - this.y) <= radius + enemy.radius) {
            this.dealDamage(enemy, this.getDamageOutput(this.stats.damage * (1.4 + tier * 0.1)), game, {
              forceCrit: true,
              noLifesteal: true,
            });
          }
        }
        game.effects.push({
          kind: "mage_skill",
          x: this.x,
          y: this.y,
          r: radius,
          t: 0.25,
          color: tier >= 2 ? "rgba(175,139,255,0.48)" : "rgba(122,191,255,0.48)",
        });
        game.effects.push({
          kind: "arcane_burst",
          x: this.x,
          y: this.y,
          r: radius * 0.76,
          t: 0.22,
          color: tier >= 3 ? "rgba(255,181,118,0.44)" : "rgba(153,215,255,0.4)",
        });

        const ringBolts = 6 + tier * 2;
        const ringVisual = tier >= 3 ? "plasma_orb" : tier >= 2 ? "void_spike" : "rune_disc";
        for (let i = 0; i < ringBolts; i += 1) {
          const a = (Math.PI * 2 * i) / ringBolts;
          game.projectiles.push(
            new CG.Projectile(this.x, this.y, Math.cos(a) * 260, Math.sin(a) * 260, {
              owner: "player",
              damage: this.getDamageOutput(this.stats.damage * (0.28 + tier * 0.04)),
              radius: tier >= 2 ? 5 : 4,
              ttl: 0.74 + tier * 0.08,
              color: "#98dfff",
              sourcePlayer: this,
              noLifesteal: true,
              isProc: true,
              visual: ringVisual,
              trailColor: tier >= 2 ? "rgba(209,154,255,0.52)" : "rgba(145,230,255,0.48)",
            })
          );
        }

        if (tier >= 3) {
          game.projectiles.push(
            new CG.Projectile(this.x, this.y, aim.x * this.stats.projectileSpeed * 0.82, aim.y * this.stats.projectileSpeed * 0.82, {
              owner: "player",
              damage: this.getDamageOutput(this.stats.damage * 0.92),
              radius: 9,
              ttl: 1.25,
              color: "#ffbe6d",
              splash: 52,
              sourcePlayer: this,
              isProc: false,
              visual: "plasma_orb",
              trailColor: "rgba(255,188,120,0.58)",
            })
          );
        }

        this.tryTriggerPowers("onSkill", game, { classKey: this.classKey });
        game.log = `${this.id} 释放技能【${this.skillDef.name}】`;
      }
    }

    attack(game) {
      this.spriteAttackDuration = 0.24;
      this.spriteAttackTimer = this.spriteAttackDuration;
      const tier = this.weaponRarityTier();
      if (this.classKey === "samurai") {
        const reach = 58;
        for (const enemy of game.enemies) {
          if (!enemy.alive) continue;
          const dx = enemy.x - this.x;
          const dy = enemy.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist > reach + enemy.radius) continue;

          const nx = dx / Math.max(dist, 0.001);
          const ny = dy / Math.max(dist, 0.001);
          const aimDot = nx * this.lastAim.x + ny * this.lastAim.y;
          if (aimDot < -0.25) continue;

          this.dealDamage(enemy, this.getDamageOutput(this.stats.damage), game, { forceCrit: false });
        }

        const wave = normalize(this.lastAim.x, this.lastAim.y);
        if (wave) {
          const slashVisual = tier >= 3 ? "boss_scythe" : tier >= 2 ? "shadow_blade" : "blade_wave";
          game.projectiles.push(
            new CG.Projectile(this.x, this.y, wave.x * 300, wave.y * 300, {
              owner: "player",
              damage: this.getDamageOutput(this.stats.damage * (0.4 + tier * 0.06)),
              radius: 5,
              ttl: 0.22 + tier * 0.03,
              color: "#d8f5ff",
              sourcePlayer: this,
              noLifesteal: true,
              isProc: true,
              visual: slashVisual,
              trailColor: tier >= 2 ? "rgba(232,176,255,0.46)" : "rgba(188,232,255,0.4)",
            })
          );
        }

        game.effects.push({
          kind: "sword_arc",
          x: this.x,
          y: this.y,
          r: reach,
          t: 0.13,
          color: "rgba(255,185,120,0.55)",
          dirX: this.lastAim.x,
          dirY: this.lastAim.y,
        });
        if (tier >= 2) {
          game.effects.push({
            kind: "trail_slash",
            x: this.x,
            y: this.y,
            r: reach + 12,
            t: 0.14,
            color: "rgba(227,171,255,0.4)",
            dirX: this.lastAim.x,
            dirY: this.lastAim.y,
          });
        }
        return;
      }

      const speed = this.stats.projectileSpeed;
      const dir = normalize(this.lastAim.x, this.lastAim.y);
      if (!dir) return;

      if (this.classKey === "archer") {
        const archVisual = tier >= 3 ? "star_lance" : tier >= 2 ? "boss_lance" : tier >= 1 ? "arrow" : "arrow";
        game.projectiles.push(
          new CG.Projectile(this.x, this.y, dir.x * speed * (1 + tier * 0.04), dir.y * speed * (1 + tier * 0.04), {
            owner: "player",
            damage: this.getDamageOutput(this.stats.damage * (1 + tier * 0.06)),
            radius: 5 + (tier >= 2 ? 1 : 0),
            ttl: 1.4 + tier * 0.05,
            color: "#9be564",
            sourcePlayer: this,
            isProc: false,
            visual: archVisual,
            trailColor: tier >= 2 ? "rgba(210,164,255,0.54)" : "rgba(170,245,118,0.5)",
          })
        );
        game.effects.push({
          kind: "arc_burst",
          x: this.x + dir.x * 18,
          y: this.y + dir.y * 18,
          r: 24 + tier * 5,
          t: 0.1,
          color: tier >= 2 ? "rgba(212,166,255,0.38)" : "rgba(188,255,122,0.35)",
        });
      } else if (this.classKey === "mage") {
        const mageVisual = tier >= 3 ? "plasma_orb" : tier >= 2 ? "void_spike" : tier >= 1 ? "arcane_orb" : "magic_orb";
        game.projectiles.push(
          new CG.Projectile(this.x, this.y, dir.x * speed, dir.y * speed, {
            owner: "player",
            damage: this.getDamageOutput(this.stats.damage * (1 + tier * 0.08)),
            radius: tier >= 2 ? 7 : 8,
            ttl: 1.2 + tier * 0.06,
            color: "#8ec5ff",
            splash: 34 + tier * 6,
            sourcePlayer: this,
            isProc: false,
            visual: mageVisual,
            trailColor: tier >= 2 ? "rgba(228,167,255,0.54)" : "rgba(142,197,255,0.55)",
          })
        );
        game.effects.push({
          kind: "arcane_burst",
          x: this.x + dir.x * 16,
          y: this.y + dir.y * 16,
          r: 26 + tier * 5,
          t: 0.12,
          color: tier >= 3 ? "rgba(255,183,117,0.4)" : "rgba(154,214,255,0.35)",
        });
      }
    }

    draw(ctx) {
      const drawn = CG.SpriteSystem.drawEntity(ctx, this);
      if (!drawn) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = CLASS_DEFS[this.classKey].color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      this.drawEquipmentOverlay(ctx);

      if (this.invincible) {
        ctx.save();
        ctx.strokeStyle = "#ffee93";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (this.barrierTimer > 0 && this.barrierValue > 0) {
        ctx.save();
        ctx.strokeStyle = "rgba(120,220,255,0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      this.drawWeaponModel(ctx);

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = "#111";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.id, 0, 4);
      ctx.restore();
    }
  }

  CG.Player = Player;
})();
