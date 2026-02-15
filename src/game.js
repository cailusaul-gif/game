(() => {
  const CG = (window.CoopGame = window.CoopGame || {});
  const { GAME_STATES, CONTROL_SETS, CLASS_PICK_KEYS, ENEMY_DEFS } = CG.CONSTANTS;
  const { randInt, clamp } = CG.Utils;
  const LEADERBOARD_KEY = "coop_adventure_rank_v1";
  const LEADERBOARD_MAX = 20;

  function makeMerchantOffers(levelIndex, count) {
    const offers = [];
    const n = count || 4;
    for (let i = 0; i < n; i += 1) {
      const item = CG.EquipmentSystem.makeRandomItem({ levelIndex });
      const score = Math.max(10, CG.EquipmentSystem.equipmentScore(item));
      const rarityMul = item?.rarity?.mul || 1;
      const price = Math.max(
        28,
        Math.round((score * 2.3 + levelIndex * 7) * (0.9 + Math.random() * 0.26) * (0.95 + (rarityMul - 1) * 0.36))
      );
      offers.push({
        id: `offer_${levelIndex}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        item,
        price,
        sold: false,
      });
    }
    return offers;
  }

  class Room {
    constructor(index, isBossRoom, options) {
      const opts = options || {};
      this.index = index;
      this.levelIndex = opts.levelIndex || 1;
      this.difficultyTier = opts.difficultyTier || 0;
      this.isBossRoom = isBossRoom;
      this.isCamp = !!opts.isCamp;
      this.style = this.isCamp
        ? "forest"
        : isBossRoom
          ? "citadel"
          : CG.MapSystem.STYLE_KEYS[randInt(0, CG.MapSystem.STYLE_KEYS.length)];
      this.spawned = false;
      this.cleared = this.isCamp;
      this.lootDropped = this.isCamp;
      this.nextLevelIndex = opts.nextLevelIndex || this.levelIndex + 1;
      this.map = CG.MapSystem.createRoomMap(!this.isCamp && isBossRoom, this.style);
      this.merchant = null;

      if (this.isCamp) {
        this.merchant = {
          x: this.map.widthPx * 0.5,
          y: this.map.heightPx * 0.5,
          radius: 24,
          restockCost: 120 + Math.max(0, this.levelIndex - 1) * 6,
          healUpgradeCost: 100 + Math.max(0, this.levelIndex - 1) * 10,
          healUpgradeSold: false,
          offers: makeMerchantOffers(this.nextLevelIndex, 4),
        };
      }
    }

    spawnEnemies() {
      if (this.isCamp) return [];
      if (this.spawned) return [];
      this.spawned = true;

      if (this.isBossRoom) {
        const center = CG.MapSystem.getRandomOpenPosition(this.map, 28);
        return [
          new CG.Boss(center.x, center.y, {
            levelIndex: this.levelIndex,
            difficultyTier: this.difficultyTier,
            bonusSkills: this.difficultyTier,
          }),
        ];
      }

      const count = randInt(3 + this.difficultyTier, 7 + this.difficultyTier + 1);
      const list = [];
      const depthScale = 1 + this.index * 0.14 + this.difficultyTier * 0.12;
      const eliteMin = (this.index <= 0 ? 1 : this.index === 1 ? 2 : 2 + Math.floor(this.index / 2)) + Math.floor(this.difficultyTier / 2);
      const eliteMax = Math.min(10, eliteMin + 2 + Math.floor(this.difficultyTier / 3));
      for (let i = 0; i < count; i += 1) {
        const roll = Math.random();
        const type = roll < 0.52 ? "grunt" : roll < 0.8 ? "shooter" : "tank";
        const scale = depthScale * (type === "tank" ? 1.06 : 1);
        const radius = ENEMY_DEFS[type].radius * scale;
        const pos = CG.MapSystem.getRandomOpenPosition(this.map, radius + 2);
        list.push(
          new CG.Enemy(type, pos.x, pos.y, scale, {
            eliteMin,
            eliteMax,
            difficultyTier: this.difficultyTier,
          })
        );
      }
      return list;
    }
  }

  class Level {
    constructor(mapCount, options) {
      const opts = options || {};
      this.levelIndex = opts.levelIndex || 1;
      this.difficultyTier = opts.difficultyTier || 0;
      this.isCamp = !!opts.isCamp;
      if (this.isCamp) {
        this.rooms = [
          new Room(0, false, {
            isCamp: true,
            levelIndex: this.levelIndex,
            nextLevelIndex: opts.nextLevelIndex || this.levelIndex + 1,
            difficultyTier: this.difficultyTier,
          }),
        ];
        return;
      }

      this.rooms = Array.from({ length: mapCount }, (_, i) =>
        new Room(i, i === mapCount - 1, {
          levelIndex: this.levelIndex,
          difficultyTier: this.difficultyTier,
        })
      );
    }
  }

  class Game {
    constructor(canvas, statusLine, helpPanel, gameOverPanel, options) {
      const opts = options || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.input = new CG.Input();
      this.renderer = new CG.Renderer(canvas, this.ctx);
      this.hud = new CG.HUD(statusLine, helpPanel);
      CG.SpriteSystem.prime();
      this.singlePlayerMode = !!opts.singlePlayer;

      this.state = GAME_STATES.CLASS_SELECT;
      this.selected = { p1: "samurai", p2: "archer" };

      this.levelIndex = 1;
      this.difficultyTier = 0;
      this.pendingLevelIndex = 2;
      this.level = null;
      this.roomIndex = 0;
      this.currentRoom = null;
      this.currentMap = null;

      this.players = [];
      this.enemies = [];
      this.projectiles = [];
      this.loots = [];
      this.effects = [];
      this.log = "";
      this.lastRewardText = "";
      this.gameOverPanel = gameOverPanel || null;
      this.rankNameInput = this.gameOverPanel ? this.gameOverPanel.querySelector("#rankNameInput") : null;
      this.rankSubmitBtn = this.gameOverPanel ? this.gameOverPanel.querySelector("#rankSubmitBtn") : null;
      this.rankList = this.gameOverPanel ? this.gameOverPanel.querySelector("#rankList") : null;
      this.gameOverSummary = this.gameOverPanel ? this.gameOverPanel.querySelector("#gameOverSummary") : null;
      this.rankSubmitHint = this.gameOverPanel ? this.gameOverPanel.querySelector("#rankSubmitHint") : null;
      this.pendingScore = null;
      this.scoreSubmitted = false;
      this.leaderboard = this.loadLeaderboard();
      this.merchantSelection = Object.create(null);

      this.bindGameOverPanel();
      this.renderLeaderboard();
      this.hideGameOverPanel();

      this.lastTime = performance.now();
      requestAnimationFrame(this.loop.bind(this));
    }

    bindGameOverPanel() {
      if (!this.gameOverPanel) return;

      if (this.rankSubmitBtn) {
        this.rankSubmitBtn.addEventListener("click", () => this.submitPendingScore());
      }

      if (this.rankNameInput) {
        this.rankNameInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.submitPendingScore();
          }
        });
      }
    }

    hideGameOverPanel() {
      if (!this.gameOverPanel) return;
      this.gameOverPanel.classList.add("hidden");
    }

    showGameOverPanel() {
      if (!this.gameOverPanel) return;
      this.gameOverPanel.classList.remove("hidden");
      if (this.rankNameInput) {
        setTimeout(() => this.rankNameInput.focus(), 0);
      }
    }

    canReturnToClassSelect() {
      if (this.state === GAME_STATES.GAME_OVER) {
        return !!this.scoreSubmitted || !this.gameOverPanel;
      }
      return true;
    }

    sanitizeName(name) {
      const text = String(name || "").trim().slice(0, 16);
      return text || "无名冒险者";
    }

    escapeHtml(text) {
      return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    sortLeaderboard(list) {
      return list.sort((a, b) => b.level - a.level || b.kills - a.kills || a.at - b.at);
    }

    loadLeaderboard() {
      try {
        const raw = window.localStorage.getItem(LEADERBOARD_KEY);
        if (!raw) return [];
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) return [];
        const list = data
          .filter((row) => row && typeof row.level === "number" && typeof row.kills === "number" && typeof row.at === "number")
          .map((row) => ({
            name: this.sanitizeName(row.name),
            level: Math.max(1, Math.floor(row.level)),
            kills: Math.max(0, Math.floor(row.kills)),
            at: row.at,
          }));
        return this.sortLeaderboard(list).slice(0, LEADERBOARD_MAX);
      } catch (_err) {
        return [];
      }
    }

    saveLeaderboard() {
      try {
        window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(this.leaderboard.slice(0, LEADERBOARD_MAX)));
      } catch (_err) {
        // ignore storage failures
      }
    }

    renderLeaderboard() {
      if (!this.rankList) return;
      if (!Array.isArray(this.leaderboard) || this.leaderboard.length <= 0) {
        this.rankList.innerHTML = "<li>暂无记录</li>";
        return;
      }

      this.rankList.innerHTML = this.leaderboard
        .slice(0, LEADERBOARD_MAX)
        .map((row, idx) => {
          const name = this.escapeHtml(row.name);
          return `<li>#${idx + 1} ${name} - 第 ${row.level} 关 · 击杀 ${row.kills}</li>`;
        })
        .join("");
    }

    triggerGameOver(message) {
      if (this.state === GAME_STATES.GAME_OVER) return;
      this.state = GAME_STATES.GAME_OVER;
      this.log = message || (this.singlePlayerMode ? "冒险者倒下了" : "两位玩家都倒下了");

      const totalKills = this.players.reduce((sum, p) => sum + (p && p.kills ? p.kills : 0), 0);
      this.pendingScore = {
        level: Math.max(1, this.levelIndex),
        kills: Math.max(0, Math.floor(totalKills)),
        at: Date.now(),
      };
      this.scoreSubmitted = !this.gameOverPanel;

      if (!this.gameOverPanel) return;

      if (this.rankNameInput) {
        this.rankNameInput.value = "";
        this.rankNameInput.disabled = false;
      }
      if (this.rankSubmitBtn) this.rankSubmitBtn.disabled = false;
      if (this.gameOverSummary) {
        this.gameOverSummary.textContent = `本次成绩：到达第 ${this.pendingScore.level} 关，总击杀 ${this.pendingScore.kills}。`;
      }
      if (this.rankSubmitHint) {
        this.rankSubmitHint.textContent = "请输入名字并提交成绩，提交后才能返回职业选择。";
      }

      this.renderLeaderboard();
      this.showGameOverPanel();
    }

    submitPendingScore() {
      if (this.state !== GAME_STATES.GAME_OVER) return false;
      if (this.scoreSubmitted || !this.pendingScore) return false;

      const name = this.sanitizeName(this.rankNameInput ? this.rankNameInput.value : "");
      this.leaderboard.push({
        name,
        level: this.pendingScore.level,
        kills: this.pendingScore.kills,
        at: this.pendingScore.at,
      });
      this.leaderboard = this.sortLeaderboard(this.leaderboard).slice(0, LEADERBOARD_MAX);
      this.saveLeaderboard();
      this.renderLeaderboard();

      this.scoreSubmitted = true;
      this.pendingScore = null;
      if (this.rankNameInput) this.rankNameInput.disabled = true;
      if (this.rankSubmitBtn) this.rankSubmitBtn.disabled = true;
      this.input.pressed.delete("Enter");
      if (this.rankSubmitHint) this.rankSubmitHint.textContent = `${name} 的成绩已提交，按 Enter 返回职业选择。`;
      return true;
    }

    startNewRun() {
      this.levelIndex = 1;
      this.difficultyTier = 0;
      this.pendingLevelIndex = 2;
      this.level = new Level(randInt(3, 6), {
        levelIndex: this.levelIndex,
        difficultyTier: this.difficultyTier,
      });

      const firstMap = this.level.rooms[0].map;
      this.players = [new CG.Player("P1", this.selected.p1, CONTROL_SETS.p1, firstMap.spawnPoints[0].x, firstMap.spawnPoints[0].y)];
      if (!this.singlePlayerMode) {
        this.players.push(new CG.Player("P2", this.selected.p2, CONTROL_SETS.p2, firstMap.spawnPoints[1].x, firstMap.spawnPoints[1].y));
      }
      this.merchantSelection = Object.create(null);
      for (const p of this.players) {
        this.merchantSelection[p.id] = 0;
      }

      this.enterRoom(0);
      this.state = GAME_STATES.PLAYING;
      this.log = "进入第 1 个关卡";
      this.lastRewardText = "";
      this.pendingScore = null;
      this.scoreSubmitted = false;
      this.hideGameOverPanel();
    }

    enterCombatLevel(levelIndex) {
      this.levelIndex = levelIndex;
      this.difficultyTier = Math.floor((this.levelIndex - 1) / 5);
      this.pendingLevelIndex = this.levelIndex + 1;
      this.level = new Level(randInt(3, 6), {
        levelIndex: this.levelIndex,
        difficultyTier: this.difficultyTier,
      });
      this.enterRoom(0);
      this.state = GAME_STATES.PLAYING;
      this.log = `进入第 ${this.levelIndex} 关（难度阶 ${this.difficultyTier + 1}）`;
    }

    enterCamp(nextLevelIndex) {
      this.pendingLevelIndex = nextLevelIndex;
      this.level = new Level(1, {
        isCamp: true,
        levelIndex: nextLevelIndex - 1,
        nextLevelIndex,
        difficultyTier: Math.floor((nextLevelIndex - 1) / 5),
      });
      this.enterRoom(0);
      this.state = GAME_STATES.PLAYING;
      this.log = `抵达休息营地（第${nextLevelIndex}关前）`;
      for (const p of this.players) {
        this.merchantSelection[p.id] = 0;
      }
    }

    advanceAfterLevelComplete() {
      const revivedPlayers = [];
      for (const player of this.players) {
        if (!player.alive) {
          player.revive(0.5);
          revivedPlayers.push(player);
        }
        player.potions = player.maxHealsPerRun;
      }

      const nextLevel = this.levelIndex + 1;
      if (this.levelIndex % 3 === 0) {
        this.enterCamp(nextLevel);
      } else {
        this.enterCombatLevel(nextLevel);
      }

      if (revivedPlayers.length > 0) {
        const names = revivedPlayers.map((p) => p.id).join("、");
        this.log += ` | ${names} 已复活`;
        for (const player of revivedPlayers) {
          this.effects.push({
            kind: "revive",
            x: player.x,
            y: player.y,
            r: player.radius + 14,
            t: 0.25,
            color: "rgba(146,255,171,0.5)",
          });
        }
      }
    }

    enterRoom(index) {
      this.roomIndex = index;
      this.currentRoom = this.level.rooms[index];
      this.currentMap = this.currentRoom.map;
      this.enemies = this.currentRoom.spawnEnemies();
      this.projectiles = [];
      this.loots = [];
      this.effects = [];

      for (let i = 0; i < this.players.length; i += 1) {
        const p = this.players[i];
        if (!p.alive) continue;
        const spawn = this.currentMap.spawnPoints[i] || this.currentMap.spawnPoints[0];
        p.x = spawn.x;
        p.y = spawn.y;
      }
    }

    nextRoom() {
      if (this.roomIndex < this.level.rooms.length - 1) {
        this.enterRoom(this.roomIndex + 1);
        this.log = `进入地图 ${this.roomIndex + 1}/${this.level.rooms.length}`;
      }
    }

    isPlayerNearMerchant(player) {
      const room = this.currentRoom;
      if (!room || !room.isCamp || !room.merchant || !player || !player.alive) return false;
      const m = room.merchant;
      const dist = Math.hypot(player.x - m.x, player.y - m.y);
      return dist <= player.radius + m.radius + 26;
    }

    merchantCardCount(merchant) {
      const offerCount = Array.isArray(merchant?.offers) ? merchant.offers.length : 0;
      return 2 + offerCount;
    }

    getMerchantSelection(player, merchant) {
      if (!player || !merchant) return 0;
      const key = player.id;
      const total = Math.max(1, this.merchantCardCount(merchant));
      const cur = Number.isInteger(this.merchantSelection[key]) ? this.merchantSelection[key] : 0;
      const normalized = ((cur % total) + total) % total;
      this.merchantSelection[key] = normalized;
      return normalized;
    }

    getMerchantSelectionIndex(player) {
      const room = this.currentRoom;
      if (!room || !room.isCamp || !room.merchant || !player) return -1;
      return this.getMerchantSelection(player, room.merchant);
    }

    merchantOptionLabel(index, merchant) {
      if (index === 0) return "治疗上限+1";
      const offers = merchant?.offers || [];
      if (index === offers.length + 1) return "商店补货";
      const offer = offers[index - 1];
      return offer?.item?.name || "未知商品";
    }

    cycleMerchantSelection(player, step) {
      const room = this.currentRoom;
      if (!room || !room.isCamp || !room.merchant || !player || !player.alive) return false;
      if (!this.isPlayerNearMerchant(player)) return false;
      const m = room.merchant;
      const total = Math.max(1, this.merchantCardCount(m));
      const cur = this.getMerchantSelection(player, m);
      const next = ((cur + step) % total + total) % total;
      this.merchantSelection[player.id] = next;
      this.log = `${player.id} 选择商店：${this.merchantOptionLabel(next, m)}`;
      return true;
    }

    tryBuyFromMerchant(player) {
      const room = this.currentRoom;
      if (!room || !room.isCamp || !room.merchant || !player.alive) return false;
      const m = room.merchant;
      if (!this.isPlayerNearMerchant(player)) return false;

      const index = this.getMerchantSelection(player, m);
      const offers = m.offers || [];

      if (index === 0) {
        if (m.healUpgradeSold) {
          this.log = `${player.id} 治疗上限道具已售出`;
          return true;
        }
        if (player.gold < m.healUpgradeCost) {
          this.log = `${player.id} 金币不足，营地补给需要 ${m.healUpgradeCost} 金币`;
          return true;
        }
        player.gold -= m.healUpgradeCost;
        m.healUpgradeSold = true;
        player.maxHealsPerRun += 1;
        player.potions = Math.min(player.maxHealsPerRun, player.potions + 1);
        this.log = `${player.id} 购买了营地补给（-${m.healUpgradeCost}金币）：治疗上限提升到 ${player.maxHealsPerRun}`;
        return true;
      }

      if (index === offers.length + 1) {
        if (player.gold < m.restockCost) {
          this.log = `${player.id} 金币不足，商店补货需要 ${m.restockCost} 金币`;
          return true;
        }
        player.gold -= m.restockCost;
        m.offers = makeMerchantOffers(this.pendingLevelIndex, 4);
        this.log = `${player.id} 支付 ${m.restockCost} 金币，商人补货完成`;
        return true;
      }

      const pick = offers[index - 1];
      if (!pick) {
        this.log = `${player.id} 当前选择无可购买商品`;
        return true;
      }
      if (pick.sold) {
        this.log = `${player.id} ${pick.item.name} 已售出`;
        return true;
      }
      if (player.gold < pick.price) {
        this.log = `${player.id} 金币不足，${pick.item.name} 需要 ${pick.price} 金币`;
        return true;
      }
      if (!player.addToInventory(pick.item)) {
        this.log = `${player.id} 背包已满，无法购买 ${pick.item.name}`;
        return true;
      }

      player.gold -= pick.price;
      pick.sold = true;
      const rarityName = pick.item?.rarity?.name || "普通";
      this.log = `${player.id} 购买了[${rarityName}] ${pick.item.name}（-${pick.price}金币）`;
      return true;
    }

    updateCamp(dt) {
      for (const p of this.players) p.update(dt, this.input, this);
      for (const pr of this.projectiles) pr.update(dt, this);
      for (const loot of this.loots) loot.update(this);

      for (const fx of this.effects) fx.t -= dt;
      this.effects = this.effects.filter((fx) => fx.t > 0);
      this.projectiles = this.projectiles.filter((p) => p.alive);
      this.loots = this.loots.filter((l) => l.alive);

      for (const p of this.players) {
        if (!p.alive) continue;
        if (this.input.consume(p.controls.interact)) {
          this.tryBuyFromMerchant(p);
        }
      }

      if (this.inPortal()) {
        this.enterCombatLevel(this.pendingLevelIndex);
        return;
      }

      if (this.players.every((p) => !p.alive)) {
        this.triggerGameOver(this.singlePlayerMode ? "冒险者倒下了" : "两位玩家都倒下了");
      }
    }

    moveEntity(entity, dx, dy) {
      if (!this.currentMap) return;
      const next = CG.Collision.moveCircleWithMapCollision(this.currentMap, entity, dx, dy);
      entity.x = next.x;
      entity.y = next.y;
    }

    inPortal() {
      const p = this.currentMap.portal;
      return this.players.some((player) => {
        if (!player.alive) return false;
        return (
          player.x + player.radius > p.x &&
          player.x - player.radius < p.x + p.w &&
          player.y + player.radius > p.y &&
          player.y - player.radius < p.y + p.h
        );
      });
    }

    updateClassSelect() {
      for (const [key, v] of Object.entries(CLASS_PICK_KEYS.p1)) {
        if (this.input.consume(key)) this.selected.p1 = v;
      }
      if (!this.singlePlayerMode) {
        for (const [key, v] of Object.entries(CLASS_PICK_KEYS.p2)) {
          if (this.input.consume(key)) this.selected.p2 = v;
        }
      }
      if (this.input.consume("Enter")) {
        this.startNewRun();
      }
    }

    updatePlaying(dt) {
      if (this.currentRoom && this.currentRoom.isCamp) {
        this.updateCamp(dt);
        return;
      }

      for (const p of this.players) p.update(dt, this.input, this);
      for (const e of this.enemies) e.update(dt, this);
      for (const pr of this.projectiles) pr.update(dt, this);
      for (const loot of this.loots) loot.update(this);

      this.processEnemyRewards();

      for (const fx of this.effects) fx.t -= dt;
      this.effects = this.effects.filter((fx) => fx.t > 0);

      this.enemies = this.enemies.filter((e) => e.alive);
      this.projectiles = this.projectiles.filter((p) => p.alive);
      this.loots = this.loots.filter((l) => l.alive);

      if (this.enemies.length === 0 && !this.currentRoom.cleared) {
        this.currentRoom.cleared = true;
        this.log = this.currentRoom.isBossRoom ? "Boss 已击败，前往传送门进入下一关" : "清空地图，前往传送门";

        if (!this.currentRoom.lootDropped && !this.currentRoom.isBossRoom) {
          this.currentRoom.lootDropped = true;
          const pos = CG.MapSystem.getRandomOpenPosition(this.currentMap, 12);
          this.loots.push(new CG.Loot(pos.x, pos.y, CG.EquipmentSystem.makeRandomItem({ levelIndex: this.levelIndex })));
        }

        for (const player of this.players) {
          if (!player.alive) continue;
          player.addGold(this.currentRoom.isBossRoom ? 80 : 25);
        }
      }

      if (this.currentRoom.cleared && this.inPortal()) {
        if (this.currentRoom.isBossRoom) {
          this.advanceAfterLevelComplete();
          return;
        }
        this.nextRoom();
      }

      if (this.players.every((p) => !p.alive)) {
        this.triggerGameOver(this.singlePlayerMode ? "冒险者倒下了" : "两位玩家都倒下了");
      }
    }

    processEnemyRewards() {
      const defeated = this.enemies.filter((e) => !e.alive && !e.rewarded);
      if (defeated.length === 0) return;

      let gainedGold = 0;
      let gainedXp = 0;
      let levelUps = 0;

      for (const enemy of defeated) {
        enemy.rewarded = true;
        gainedGold += enemy.goldDrop || 0;
        gainedXp += enemy.xpDrop || 0;
        const eliteCount = Array.isArray(enemy.eliteSkills) ? enemy.eliteSkills.length : 0;
        if (enemy.type === "boss") {
          this.loots.push(
            new CG.Loot(
              enemy.x + randInt(-20, 21),
              enemy.y + randInt(-20, 21),
              CG.EquipmentSystem.makeRandomItem({ levelIndex: this.levelIndex, minRarity: "epic" })
            )
          );
          const extra = randInt(1, 3);
          for (let i = 0; i < extra; i += 1) {
            this.loots.push(
              new CG.Loot(
                enemy.x + randInt(-36, 37),
                enemy.y + randInt(-36, 37),
                CG.EquipmentSystem.makeRandomItem({ levelIndex: this.levelIndex })
              )
            );
          }
          continue;
        }

        const dropChance = Math.min(0.45, 0.1 + eliteCount * 0.06);
        if (Math.random() < dropChance) {
          this.loots.push(
            new CG.Loot(
              enemy.x + randInt(-20, 21),
              enemy.y + randInt(-20, 21),
              CG.EquipmentSystem.makeRandomItem({ levelIndex: this.levelIndex })
            )
          );
        }
      }

      for (const player of this.players) {
        if (!player.alive) continue;
        player.addGold(gainedGold);
        levelUps += player.gainXp(gainedXp);
        player.kills += defeated.length;
      }

      const parts = [];
      if (gainedGold > 0) parts.push(`金币+${gainedGold}`);
      if (gainedXp > 0) parts.push(`经验+${gainedXp}`);
      if (levelUps > 0) parts.push(`升级x${levelUps}`);
      if (parts.length > 0) {
        this.lastRewardText = parts.join(" / ");
        this.log = `击败敌人: ${this.lastRewardText}`;
      }
    }

    update(dt) {
      if (this.state === GAME_STATES.CLASS_SELECT) {
        this.updateClassSelect();
      } else if (this.state === GAME_STATES.PLAYING) {
        this.updatePlaying(dt);
      } else if (this.input.consume("Enter")) {
        if (this.canReturnToClassSelect()) {
          this.state = GAME_STATES.CLASS_SELECT;
          this.hideGameOverPanel();
        }
      }

      this.renderer.draw(this);
      this.hud.draw(this);
      this.input.endFrame();
    }

    loop(now) {
      const dt = clamp((now - this.lastTime) / 1000, 0, 0.033);
      this.lastTime = now;
      this.update(dt);
      requestAnimationFrame(this.loop.bind(this));
    }
  }

  CG.Game = Game;
})();
