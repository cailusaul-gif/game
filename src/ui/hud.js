(() => {
  const CG = (window.CoopGame = window.CoopGame || {});
  const { CLASS_DEFS, SLOT_KEYS, SLOT_LABELS, GAME_STATES } = CG.CONSTANTS;
  const STYLE_NAMES = {
    forest: "森林营地",
    swamp: "沼泽荒地",
    ruins: "石砌遗迹",
    citadel: "Boss堡垒",
  };

  class HUD {
    constructor(statusLine, helpPanel) {
      this.statusLine = statusLine;
      this.helpPanel = helpPanel;
    }

    draw(game) {
      if (game.state === GAME_STATES.CLASS_SELECT) {
        this.statusLine.textContent = "选择职业后按 Enter 开始";
        this.helpPanel.innerHTML = `
          <div class="panel-grid single">
            <section class="panel-card">
              <h3>职业选择</h3>
              <div>P1: <kbd>Q</kbd>武士 <kbd>W</kbd>弓箭手 <kbd>E</kbd>魔法师</div>
              <div>P2: <kbd>U</kbd>武士 <kbd>I</kbd>弓箭手 <kbd>O</kbd>魔法师</div>
              <div class="meta">当前: P1 = ${CLASS_DEFS[game.selected.p1].name}，P2 = ${CLASS_DEFS[game.selected.p2].name}</div>
              <div class="meta">进入战斗后：每位玩家都有攻击、翻滚、职业技能、治疗（每局最多2次）。</div>
            </section>
          </div>
        `;
        return;
      }

      const isCamp = !!game.currentRoom?.isCamp;
      const roomTotal = game.level ? game.level.rooms.length : 0;
      const styleName = STYLE_NAMES[game.currentMap?.style] || "未知地形";
      if (isCamp) {
        this.statusLine.textContent = `休息营地 | 下一关 ${game.pendingLevelIndex} | ${styleName} | ${game.log}`;
      } else {
        this.statusLine.textContent = `关卡 ${game.levelIndex} | 地图 ${game.roomIndex + 1}/${roomTotal} ${
          game.currentRoom && game.currentRoom.isBossRoom ? "(Boss)" : ""
        } | ${styleName} | 难度阶 ${game.difficultyTier + 1} | ${game.log}`;
      }

      const playerPanels = game.players.map((p) => this.renderPlayerPanel(p)).join("");

      let controlHint =
        "P1: WASD/F/G/R/T/E/C/V/B/X；P2: IJKL/H/Y/P/[/O/N/M/,/.（E/O 交互）。";
      if (game.state === GAME_STATES.VICTORY) {
        controlHint = "已击败 Boss，按 Enter 返回职业选择。";
      } else if (game.state === GAME_STATES.GAME_OVER) {
        controlHint = "挑战失败，按 Enter 返回职业选择。";
      } else if (isCamp) {
        controlHint = "休息营地：靠近商人按 E/O 购买（自动买当前可买最便宜）；进入上方传送门前往下一关。";
      }

      const campPanel = isCamp ? this.renderCampShop(game) : "";

      this.helpPanel.innerHTML = `
        <div class="panel-grid">
          ${playerPanels}
        </div>
        ${campPanel}
        <div class="panel-inline">
          <div class="meta">${controlHint}</div>
          <div class="meta">${game.lastRewardText ? `最近掉落：${game.lastRewardText}` : ""}</div>
          <div class="meta">常见内容已加入：等级成长、金币、治疗次数限制（每局2次）、暴击、吸血、装备品质（普通/稀有/史诗/传说）。</div>
          <div class="meta">新系统：敌人随机精英技能组合；装备新增触发技能（命中/暴击/受击/击杀/技能触发）。</div>
          <div class="meta">Boss内容：随机外形池、近战/远程双技能树、随关卡阶段持续扩展技能。</div>
        </div>
      `;
    }

    renderCampShop(game) {
      const merchant = game.currentRoom?.merchant;
      if (!merchant) return "";
      const offers = merchant.offers || [];
      const offerHtml = offers
        .map((o, idx) => {
          const rarity = o.item?.rarity || { name: "普通", color: "#cfd8dc" };
          const tag = o.sold ? "已售出" : `${o.price} 金币`;
          return `<div class="bag-slot" style="border-color:${rarity.color};opacity:${o.sold ? 0.5 : 1}">
            <div class="bag-name" style="color:${rarity.color}">${idx + 1}. ${o.item.name}</div>
            <div class="bag-meta">${SLOT_LABELS[o.item.slot]} · ${tag}</div>
          </div>`;
        })
        .join("");

      return `
        <section class="panel-card">
          <h4>营地商人</h4>
          <div class="meta">全部售罄后可花费 ${merchant.restockCost} 金币补货</div>
          <div class="bag-grid">${offerHtml}</div>
        </section>
      `;
    }

    renderPlayerPanel(player) {
      const classDef = CLASS_DEFS[player.classKey];
      const xpPercent = Math.floor((player.xp / player.xpToNext) * 100);
      const skillCd = player.skillTimer > 0 ? `${player.skillTimer.toFixed(1)}s` : "就绪";
      const skillMax = player.getSkillCooldown().toFixed(1);

      const equipHtml = SLOT_KEYS.map((slot) => {
        const item = player.equipment[slot];
        return `<li>${this.renderEquipmentLine(slot, item)}</li>`;
      }).join("");

      const stats = player.stats;

      return `
        <section class="panel-card">
          <h3 style="color:${classDef.color}">${player.id} · ${classDef.name}</h3>
          <div class="meta">HP ${Math.floor(player.hp)}/${Math.floor(stats.maxHp)} | Lv.${player.level} | EXP ${Math.floor(
            player.xp
          )}/${player.xpToNext} (${xpPercent}%)</div>
          <div class="meta">金币 ${player.gold} | 治疗次数 ${player.potions}/${player.maxHealsPerRun} | 击杀 ${player.kills}</div>

          <h4>属性</h4>
          <div class="stats-grid">
            <span>攻击 ${Math.round(stats.damage)}</span>
            <span>移速 ${Math.round(stats.speed)}</span>
            <span>减伤 ${(stats.defense * 100).toFixed(1)}%</span>
            <span>暴击率 ${(stats.critChance * 100).toFixed(1)}%</span>
            <span>暴击伤害 ${(stats.critDamage * 100).toFixed(0)}%</span>
            <span>吸血 ${(stats.lifeSteal * 100).toFixed(1)}%</span>
            <span>攻速 ${(1 / stats.attackCooldown).toFixed(2)}/s</span>
            <span>技能急速 ${(stats.skillHaste * 100).toFixed(1)}%</span>
          </div>

          <h4>技能</h4>
          <div class="meta">${player.skillDef.name}：${player.skillDef.description}</div>
          <div class="meta">冷却：${skillCd} / ${skillMax}s</div>

          <h4>装备</h4>
          <ul class="equip-list">${equipHtml}</ul>

          <h4>背包</h4>
          <div class="bag-grid">${this.renderInventory(player)}</div>
        </section>
      `;
    }

    renderInventory(player) {
      const slots = [];
      for (let i = 0; i < player.inventorySize; i += 1) {
        const item = player.inventory[i];
        const isSelected = i === player.inventoryCursor && player.inventory.length > 0;
        if (!item) {
          slots.push(`<div class="bag-slot ${isSelected ? "selected" : ""}">空</div>`);
          continue;
        }

        const rarity = item.rarity || { name: "普通", color: "#cfd8dc" };
        const powers = (item.powers || []).map((p) => p.name).join(" / ");
        slots.push(
          `<div class="bag-slot ${isSelected ? "selected" : ""}" style="border-color:${rarity.color}">
            <div class="bag-name" style="color:${rarity.color}">${item.name}</div>
            <div class="bag-meta">${SLOT_LABELS[item.slot]}${powers ? ` · ${powers}` : ""}</div>
          </div>`
        );
      }
      return slots.join("");
    }

    renderEquipmentLine(slot, item) {
      if (!item) return `${SLOT_LABELS[slot]}：-`;

      const rarity = item.rarity || { name: "普通", color: "#cfd8dc" };
      const bonusText = Object.entries(item.bonuses || {})
        .map(([k, v]) => `${CG.EquipmentSystem.bonusLabel(k)}${CG.EquipmentSystem.formatBonus(k, v)}`)
        .join(" / ");
      const powerText = (item.powers || []).map((p) => CG.EquipmentSystem.formatPower(p)).join("；");

      return `${SLOT_LABELS[slot]}：<span style="color:${rarity.color}">[${rarity.name}] ${item.name}</span> <span class="meta">${bonusText}${
        powerText ? ` | ${powerText}` : ""
      }</span>`;
    }
  }

  CG.HUD = HUD;
})();
