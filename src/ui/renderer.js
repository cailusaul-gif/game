(() => {
  const CG = (window.CoopGame = window.CoopGame || {});
  const { CLASS_DEFS, GAME_STATES } = CG.CONSTANTS;

  class Renderer {
    constructor(canvas, ctx) {
      this.canvas = canvas;
      this.ctx = ctx;
    }

    draw(game) {
      this.ctx.imageSmoothingEnabled = false;
      if (game.state === GAME_STATES.CLASS_SELECT) {
        this.drawClassSelect(game);
        return;
      }

      this.drawTileMap(game);
      this.drawPortal(game);
      this.drawCampMerchant(game);

      for (const loot of game.loots) loot.draw(this.ctx);
      for (const e of game.enemies) e.draw(this.ctx, game);
      for (const pr of game.projectiles) pr.draw(this.ctx);
      for (const p of game.players) p.draw(this.ctx, game);

      this.drawEffects(game);
      this.drawEndOverlay(game);
    }

    drawTileMap(game) {
      const { ctx } = this;
      const map = game.currentMap;
      const palette = map.palette || CG.MapSystem.STYLE_PALETTE.forest;

      const bg = ctx.createLinearGradient(0, 0, 0, map.heightPx);
      bg.addColorStop(0, palette.floor[0]);
      bg.addColorStop(1, palette.floor[2]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, map.widthPx, map.heightPx);

      for (let y = 0; y < map.rows; y += 1) {
        for (let x = 0; x < map.cols; x += 1) {
          const tx = x * map.tileSize;
          const ty = y * map.tileSize;
          const isWall = map.tiles[y][x] === CG.MapSystem.WALL;
          const obstacleTile = !!(map.obstacleMask && map.obstacleMask[y] && map.obstacleMask[y][x]);
          const variant = (x * 13 + y * 7) % 3;

          if (isWall && !obstacleTile) {
            ctx.fillStyle = palette.wall[variant];
            ctx.fillRect(tx, ty, map.tileSize, map.tileSize);
            ctx.strokeStyle = "rgba(255,255,255,0.08)";
            ctx.strokeRect(tx + 1, ty + 1, map.tileSize - 2, map.tileSize - 2);
          } else {
            ctx.fillStyle = palette.floor[variant];
            ctx.fillRect(tx, ty, map.tileSize, map.tileSize);
            ctx.strokeStyle = "rgba(255,255,255,0.03)";
            ctx.strokeRect(tx + 0.5, ty + 0.5, map.tileSize - 1, map.tileSize - 1);
          }
        }
      }

      this.drawDecorations(map, palette);
      this.drawObstacleProps(map);

      const vignette = ctx.createRadialGradient(
        map.widthPx * 0.5,
        map.heightPx * 0.46,
        map.heightPx * 0.2,
        map.widthPx * 0.5,
        map.heightPx * 0.5,
        map.heightPx * 0.7
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, map.widthPx, map.heightPx);
    }

    drawDecorations(map, palette) {
      const { ctx } = this;
      for (const deco of map.decorations || []) {
        const x = deco.x;
        const y = deco.y;
        const s = deco.size;

        if (deco.kind === "bush" || deco.kind === "moss") {
          ctx.fillStyle = palette.accents[0];
          ctx.beginPath();
          ctx.arc(x, y, s, 0, Math.PI * 2);
          ctx.fill();
        } else if (deco.kind === "flower" || deco.kind === "crystal") {
          ctx.fillStyle = palette.accents[1];
          ctx.beginPath();
          ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else if (deco.kind === "grass" || deco.kind === "reed") {
          ctx.strokeStyle = palette.accents[2];
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x - s * 0.35, y + s * 0.4);
          ctx.lineTo(x - s * 0.1, y - s * 0.4);
          ctx.moveTo(x + s * 0.35, y + s * 0.4);
          ctx.lineTo(x + s * 0.1, y - s * 0.3);
          ctx.stroke();
        } else if (deco.kind === "puddle" || deco.kind === "rune") {
          ctx.strokeStyle = palette.accents[1];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, s * 0.65, 0, Math.PI * 2);
          ctx.stroke();
        } else if (deco.kind === "pillar" || deco.kind === "rock" || deco.kind === "stone") {
          ctx.fillStyle = "rgba(20,20,20,0.25)";
          ctx.fillRect(x - s * 0.35, y - s * 0.35, s * 0.7, s * 0.7);
        } else if (deco.kind === "crack") {
          ctx.strokeStyle = "rgba(10,10,10,0.3)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x - s * 0.5, y - s * 0.4);
          ctx.lineTo(x, y + s * 0.2);
          ctx.lineTo(x + s * 0.45, y - s * 0.1);
          ctx.stroke();
        }
      }
    }

    drawObstacleProps(map) {
      const { ctx } = this;
      const props = (map.obstacleProps || []).slice().sort((a, b) => (a.depthY || a.y + a.h) - (b.depthY || b.y + b.h));

      for (const prop of props) {
        const c = prop.collider;
        if (c) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
          ctx.beginPath();
          ctx.ellipse(
            c.x + c.w * 0.5,
            c.y + c.h * 0.92,
            Math.max(8, c.w * 0.58),
            Math.max(5, c.h * 0.34),
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        const img = CG.SpriteSystem.getImage(prop.path);
        if (img && img.complete && img.naturalWidth > 0) {
          const drawW = Math.round(prop.w);
          const drawH = Math.round(prop.h);
          const drawX = Math.round(prop.x);
          const drawY = Math.round(prop.y);
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          continue;
        }

        if (c) {
          ctx.fillStyle = "rgba(16, 30, 18, 0.38)";
          ctx.fillRect(c.x, c.y, c.w, c.h);
          ctx.strokeStyle = "rgba(190, 245, 200, 0.25)";
          ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
        }
      }
    }

    drawPortal(game) {
      if (!game.currentRoom || !game.currentRoom.cleared) return;

      const { ctx } = this;
      const portal = game.currentMap.portal;
      ctx.fillStyle = "rgba(126, 238, 188, 0.75)";
      ctx.fillRect(portal.x, portal.y, portal.w, portal.h);
      ctx.strokeStyle = "#b7ffde";
      ctx.strokeRect(portal.x, portal.y, portal.w, portal.h);
      ctx.fillStyle = "#003322";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(game.currentRoom.isCamp ? "离开营地" : "传送门", portal.x + portal.w / 2, portal.y + 18);
    }

    drawCampMerchant(game) {
      if (!game.currentRoom || !game.currentRoom.isCamp || !game.currentRoom.merchant) return;
      const { ctx } = this;
      const m = game.currentRoom.merchant;

      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(m.x, m.y + m.radius * 0.88, m.radius * 1.15, m.radius * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#5f4734";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f4d8aa";
      ctx.beginPath();
      ctx.arc(m.x, m.y - 4, m.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffd88d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius + 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffe7b7";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("商人", m.x, m.y - m.radius - 10);
      ctx.restore();
    }

    drawEffects(game) {
      const { ctx } = this;
      const defaultLife = {
        crit: 0.12,
        hit: 0.08,
        circle: 0.16,
        chain_lightning: 0.08,
        nova_ring: 0.18,
        meteor_blast: 0.18,
        frost_guard: 0.18,
        blood_aura: 0.2,
        samurai_skill: 0.22,
        samurai_bloom: 0.22,
        mage_skill: 0.25,
        arcane_burst: 0.18,
        arc_burst: 0.12,
        arrow_fan: 0.18,
        sword_arc: 0.13,
        trail_slash: 0.15,
        shockwave: 0.22,
        enemy_storm: 0.2,
        enemy_blink: 0.16,
        enemy_charge: 0.2,
        boss_dash: 0.2,
        enemy_summon: 0.2,
        summon_sigil: 0.2,
        enemy_drain: 0.18,
        boss_cast: 0.22,
        boss_melee_cast: 0.24,
        boss_ranged_cast: 0.24,
        boss_rift: 0.26,
        plasma_burst: 0.22,
        boss_rain_cast: 0.26,
        revive: 0.25,
      };

      for (const fx of game.effects) {
        const life = fx.life || defaultLife[fx.kind] || 0.18;
        const p = Math.max(0, Math.min(1, fx.t / life));
        const alpha = 0.2 + p * 0.8;

        if (fx.kind === "crit") {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color || "#ffd54f";
          ctx.lineWidth = 2.5;
          for (let i = 0; i < 6; i += 1) {
            const a = (Math.PI * 2 * i) / 6;
            const r0 = fx.r * 0.2;
            const r1 = fx.r * (0.4 + (1 - p) * 0.9);
            ctx.beginPath();
            ctx.moveTo(fx.x + Math.cos(a) * r0, fx.y + Math.sin(a) * r0);
            ctx.lineTo(fx.x + Math.cos(a) * r1, fx.y + Math.sin(a) * r1);
            ctx.stroke();
          }
          ctx.restore();
          continue;
        }

        if (fx.kind === "hit") {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color || "#ffffff";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(fx.x - fx.r * 0.45, fx.y);
          ctx.lineTo(fx.x + fx.r * 0.45, fx.y);
          ctx.moveTo(fx.x, fx.y - fx.r * 0.45);
          ctx.lineTo(fx.x, fx.y + fx.r * 0.45);
          ctx.stroke();
          ctx.restore();
          continue;
        }

        if (fx.kind === "sword_arc") {
          const a = Math.atan2(fx.dirY || 0, fx.dirX || 1);
          ctx.save();
          ctx.translate(fx.x, fx.y);
          ctx.rotate(a);
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color || "#bce8ff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, fx.r, -0.9, 0.9);
          ctx.stroke();
          ctx.strokeStyle = "rgba(224,250,255,0.7)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, fx.r * 0.8, -0.72, 0.72);
          ctx.stroke();
          ctx.restore();
          continue;
        }

        if (fx.kind === "trail_slash") {
          const a = Math.atan2(fx.dirY || 0, fx.dirX || 1);
          ctx.save();
          ctx.translate(fx.x, fx.y);
          ctx.rotate(a);
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color || "#ffd7c3";
          ctx.lineWidth = 2.2;
          for (let i = 0; i < 3; i += 1) {
            ctx.beginPath();
            ctx.arc(0, 0, fx.r * (0.78 + i * 0.14), -0.9 + i * 0.12, 0.9 + i * 0.12);
            ctx.stroke();
          }
          ctx.restore();
          continue;
        }

        if (fx.kind === "arrow_fan") {
          const a = Math.atan2(fx.dirY || 0, fx.dirX || 1);
          ctx.save();
          ctx.translate(fx.x, fx.y);
          ctx.rotate(a);
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color || "#b6ff95";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(fx.r, -fx.r * 0.5);
          ctx.moveTo(0, 0);
          ctx.lineTo(fx.r, 0);
          ctx.moveTo(0, 0);
          ctx.lineTo(fx.r, fx.r * 0.5);
          ctx.stroke();
          ctx.restore();
          continue;
        }

        if (fx.kind === "arc_burst" || fx.kind === "arcane_burst") {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color || "#a8e2ff";
          ctx.lineWidth = fx.kind === "arcane_burst" ? 2.6 : 2;
          for (let i = 0; i < 2; i += 1) {
            ctx.beginPath();
            ctx.arc(fx.x, fx.y, fx.r * (0.72 + i * 0.28), 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
          continue;
        }

        if (fx.kind === "samurai_skill" || fx.kind === "samurai_bloom" || fx.kind === "mage_skill" || fx.kind === "nova_ring" || fx.kind === "circle") {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color || "#9ad6ff";
          ctx.lineWidth = fx.kind === "mage_skill" ? 3 : fx.kind === "samurai_bloom" ? 2.8 : 2.4;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.r * (1 + (1 - p) * 0.18), 0, Math.PI * 2);
          ctx.stroke();
          if (fx.kind !== "circle") {
            ctx.strokeStyle = "rgba(255,255,255,0.45)";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(fx.x, fx.y, fx.r * 0.72, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
          continue;
        }

        if (fx.kind === "chain_lightning") {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color || "#9be8ff";
          ctx.lineWidth = 2;
          const seg = 6;
          ctx.beginPath();
          for (let i = 0; i <= seg; i += 1) {
            const t = i / seg;
            const xx = fx.x - fx.r * 0.5 + fx.r * t + (Math.random() - 0.5) * 8;
            const yy = fx.y + (Math.random() - 0.5) * 12;
            if (i === 0) ctx.moveTo(xx, yy);
            else ctx.lineTo(xx, yy);
          }
          ctx.stroke();
          ctx.restore();
          continue;
        }

        if (fx.kind === "meteor_blast" || fx.kind === "enemy_storm" || fx.kind === "enemy_drain" || fx.kind === "drain" || fx.kind === "plasma_burst") {
          ctx.save();
          ctx.globalAlpha = alpha * 0.45;
          ctx.fillStyle = fx.color || "rgba(255,130,130,0.4)";
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.r * (0.75 + (1 - p) * 0.3), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color || "#ff9f9f";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          continue;
        }

        if (fx.kind === "enemy_blink") {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color || "#d39cff";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.r * (1 - p * 0.35), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          continue;
        }

        if (fx.kind === "enemy_charge" || fx.kind === "boss_dash") {
          const dirA = Math.atan2(fx.dirY || 0, fx.dirX || 1);
          ctx.save();
          ctx.translate(fx.x, fx.y);
          ctx.rotate(dirA);
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color || (fx.kind === "boss_dash" ? "#ffb9ce" : "#ff9b9b");
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(fx.r * 2.2, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(fx.r * 2.2, 0);
          ctx.lineTo(fx.r * 1.7, -fx.r * 0.3);
          ctx.lineTo(fx.r * 1.7, fx.r * 0.3);
          ctx.closePath();
          ctx.fillStyle = fx.color || (fx.kind === "boss_dash" ? "#ffb9ce" : "#ff9b9b");
          ctx.fill();
          ctx.restore();
          continue;
        }

        if (fx.kind === "enemy_summon" || fx.kind === "summon_sigil") {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color || (fx.kind === "summon_sigil" ? "#ffd2f6" : "#afff9a");
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 6; i += 1) {
            const a0 = (Math.PI * 2 * i) / 6;
            const a1 = (Math.PI * 2 * (i + 1)) / 6;
            const x0 = fx.x + Math.cos(a0) * fx.r * 0.65;
            const y0 = fx.y + Math.sin(a0) * fx.r * 0.65;
            const x1 = fx.x + Math.cos(a1) * fx.r * 0.65;
            const y1 = fx.y + Math.sin(a1) * fx.r * 0.65;
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
          }
          ctx.stroke();
          ctx.restore();
          continue;
        }

        if (
          fx.kind === "blood_aura" ||
          fx.kind === "frost_guard" ||
          fx.kind === "boss_cast" ||
          fx.kind === "boss_rain_cast" ||
          fx.kind === "boss_melee_cast" ||
          fx.kind === "boss_ranged_cast" ||
          fx.kind === "boss_rift" ||
          fx.kind === "revive" ||
          fx.kind === "shockwave"
        ) {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color || "#ffffff";
          ctx.lineWidth = fx.kind === "shockwave" ? 3 : 2.6;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2);
          ctx.stroke();
          if (fx.kind === "boss_rift" || fx.kind === "shockwave") {
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.arc(fx.x, fx.y, fx.r * 0.72, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
          continue;
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fx.color || "#ffffff";
        ctx.lineWidth = fx.kind === "crit" ? 3 : 2;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawClassSelect(game) {
      const { ctx } = this;
      ctx.fillStyle = "#151922";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = "#edf2ff";
      ctx.textAlign = "center";
      ctx.font = "bold 42px sans-serif";
      ctx.fillText("双人冒险框架", this.canvas.width / 2, 130);

      this.drawClassCard(240, 220, "P1", game.selected.p1);
      this.drawClassCard(720, 220, "P2", game.selected.p2);
    }

    drawClassCard(x, y, label, classKey) {
      const { ctx } = this;
      const info = CLASS_DEFS[classKey];
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x - 130, y - 90, 260, 180);
      ctx.strokeStyle = info.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 130, y - 90, 260, 180);

      ctx.fillStyle = info.color;
      ctx.font = "bold 30px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(info.name, x, y - 20);

      ctx.fillStyle = "#fff";
      ctx.font = "16px sans-serif";
      ctx.fillText(label, x, y - 55);
      ctx.fillText(`基础武器: ${info.weapon}`, x, y + 18);
      ctx.fillText(`HP ${info.maxHp} / 攻击 ${info.damage} / 移速 ${info.speed}`, x, y + 46);
    }

    drawEndOverlay(game) {
      if (game.state !== GAME_STATES.GAME_OVER && game.state !== GAME_STATES.VICTORY) return;

      const { ctx } = this;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.textAlign = "center";
      ctx.fillStyle = game.state === GAME_STATES.VICTORY ? "#7bffb2" : "#ffd1d1";
      ctx.font = "bold 48px sans-serif";
      ctx.fillText(
        game.state === GAME_STATES.VICTORY ? "关卡完成" : "挑战失败",
        this.canvas.width / 2,
        this.canvas.height / 2 - 10
      );
      ctx.fillStyle = "#fff";
      ctx.font = "20px sans-serif";
      ctx.fillText("按 Enter 回到职业选择", this.canvas.width / 2, this.canvas.height / 2 + 36);
    }
  }

  CG.Renderer = Renderer;
})();
