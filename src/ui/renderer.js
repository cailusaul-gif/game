(() => {
  const CG = (window.CoopGame = window.CoopGame || {});
  const { CLASS_DEFS, GAME_STATES } = CG.CONSTANTS;

  class Renderer {
    constructor(canvas, ctx) {
      this.canvas = canvas;
      this.ctx = ctx;
      this.propToneByStyle = {
        forest: {
          tint: "rgba(104,138,90,0.2)",
          shade: "rgba(28,44,27,0.14)",
          ground: "rgba(79,116,76,0.2)",
          edge: "rgba(176,214,162,0.22)",
        },
        swamp: {
          tint: "rgba(90,128,114,0.22)",
          shade: "rgba(22,38,34,0.16)",
          ground: "rgba(73,111,98,0.22)",
          edge: "rgba(157,204,183,0.2)",
        },
        ruins: {
          tint: "rgba(134,126,106,0.18)",
          shade: "rgba(38,33,27,0.16)",
          ground: "rgba(114,106,90,0.2)",
          edge: "rgba(210,198,170,0.18)",
        },
        citadel: {
          tint: "rgba(119,99,138,0.2)",
          shade: "rgba(31,24,40,0.18)",
          ground: "rgba(92,78,116,0.2)",
          edge: "rgba(191,171,220,0.2)",
        },
      };
    }

    tileNoise(x, y, salt) {
      let n = (((x + 11) * 374761393) ^ ((y + 17) * 668265263) ^ ((salt + 3) * 362437)) >>> 0;
      n ^= n >>> 13;
      n = Math.imul(n, 1274126177) >>> 0;
      n ^= n >>> 16;
      return n / 4294967295;
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
      const ts = map.tileSize;

      const bg = ctx.createLinearGradient(0, 0, 0, map.heightPx);
      bg.addColorStop(0, palette.floor[0]);
      bg.addColorStop(1, palette.floor[2]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, map.widthPx, map.heightPx);

      for (let y = 0; y < map.rows; y += 1) {
        for (let x = 0; x < map.cols; x += 1) {
          const tx = x * ts;
          const ty = y * ts;
          const isWall = map.tiles[y][x] === CG.MapSystem.WALL;
          const obstacleTile = !!(map.obstacleMask && map.obstacleMask[y] && map.obstacleMask[y][x]);
          const n0 = this.tileNoise(x, y, 1);
          const n1 = this.tileNoise(x, y, 2);
          const n2 = this.tileNoise(x, y, 4);
          const macroFloor = this.tileNoise(Math.floor(x / 3), Math.floor(y / 3), 8);
          const macroWall = this.tileNoise(Math.floor(x / 2), Math.floor(y / 2), 9);
          const floorMix = n0 * 0.56 + macroFloor * 0.44;
          const wallMix = n1 * 0.54 + macroWall * 0.46;
          const floorVariant = floorMix < 0.35 ? 0 : floorMix < 0.72 ? 1 : 2;
          const wallVariant = wallMix < 0.34 ? 0 : wallMix < 0.68 ? 1 : 2;

          if (isWall && !obstacleTile) {
            ctx.fillStyle = palette.wall[wallVariant];
            ctx.fillRect(tx, ty, ts, ts);
            if (n0 > 0.76) {
              ctx.fillStyle = "rgba(255,255,255,0.02)";
              ctx.fillRect(tx + 1, ty + 1, ts - 2, 1);
            }
            if (n2 > 0.78) {
              ctx.fillStyle = "rgba(0,0,0,0.11)";
              ctx.fillRect(tx + ts * 0.25, ty + ts * 0.2, 2, 2);
            }
          } else {
            ctx.fillStyle = palette.floor[floorVariant];
            ctx.fillRect(tx, ty, ts, ts);
            if (n1 > 0.86) {
              ctx.fillStyle = "rgba(255,255,255,0.03)";
              ctx.beginPath();
              ctx.ellipse(tx + ts * 0.56, ty + ts * 0.46, ts * 0.24, ts * 0.18, 0, 0, Math.PI * 2);
              ctx.fill();
            } else if (n1 < 0.08) {
              ctx.fillStyle = "rgba(0,0,0,0.03)";
              ctx.fillRect(tx + ts * 0.2, ty + ts * 0.2, ts * 0.6, ts * 0.6);
            }
            if (n2 > 0.91) {
              ctx.fillStyle = "rgba(255,255,255,0.04)";
              ctx.fillRect(tx + ts * 0.64, ty + ts * 0.32, 1, 1);
            }
          }
        }
      }

      for (let y = 0; y < map.rows; y += 2) {
        for (let x = 0; x < map.cols; x += 2) {
          if (map.tiles[y][x] === CG.MapSystem.WALL) continue;
          const m = this.tileNoise(x >> 1, y >> 1, 11);
          if (m > 0.64) {
            ctx.fillStyle = m > 0.82 ? "rgba(255,255,255,0.014)" : "rgba(0,0,0,0.017)";
            ctx.fillRect(x * ts, y * ts, ts * 2, ts * 2);
          }
        }
      }

      const terrainTint = ctx.createLinearGradient(0, 0, map.widthPx, map.heightPx);
      terrainTint.addColorStop(0, "rgba(255,255,255,0.03)");
      terrainTint.addColorStop(0.5, "rgba(0,0,0,0)");
      terrainTint.addColorStop(1, "rgba(0,0,0,0.06)");
      ctx.fillStyle = terrainTint;
      ctx.fillRect(0, 0, map.widthPx, map.heightPx);
      this.drawStyleMaterialLayer(map, palette);

      this.drawDecorations(map, palette);
      this.drawObstacleProps(map, palette);

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

    drawStyleMaterialLayer(map, palette) {
      const { ctx } = this;
      const ts = map.tileSize;

      for (let y = 0; y < map.rows; y += 1) {
        for (let x = 0; x < map.cols; x += 1) {
          if (map.tiles[y][x] === CG.MapSystem.WALL) continue;
          const tx = x * ts;
          const ty = y * ts;
          const n0 = this.tileNoise(x, y, 31);
          const n1 = this.tileNoise(x, y, 32);
          const n2 = this.tileNoise(x, y, 33);

          if (map.style === "forest") {
            if (n0 > 0.78) {
              ctx.fillStyle = "rgba(143,182,108,0.14)";
              ctx.beginPath();
              ctx.ellipse(tx + ts * 0.54, ty + ts * 0.5, ts * 0.36, ts * 0.24, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            if (n1 < 0.12) {
              ctx.strokeStyle = "rgba(171,146,104,0.22)";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(tx + ts * 0.25, ty + ts * 0.74);
              ctx.lineTo(tx + ts * 0.42, ty + ts * 0.56);
              ctx.lineTo(tx + ts * 0.61, ty + ts * 0.76);
              ctx.stroke();
            }
            if (n2 > 0.9) {
              ctx.fillStyle = "rgba(213,231,161,0.18)";
              ctx.fillRect(tx + ts * 0.66, ty + ts * 0.28, 2, 2);
            }
          } else if (map.style === "swamp") {
            if (n0 > 0.74) {
              ctx.fillStyle = "rgba(61,94,95,0.2)";
              ctx.beginPath();
              ctx.ellipse(tx + ts * 0.56, ty + ts * 0.55, ts * 0.33, ts * 0.2, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = "rgba(129,183,173,0.18)";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.ellipse(tx + ts * 0.56, ty + ts * 0.55, ts * 0.24, ts * 0.13, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            if (n1 < 0.1) {
              ctx.strokeStyle = "rgba(44,69,67,0.26)";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(tx + ts * 0.18, ty + ts * 0.22);
              ctx.lineTo(tx + ts * 0.76, ty + ts * 0.68);
              ctx.stroke();
            }
            if (n2 > 0.88) {
              ctx.fillStyle = "rgba(182,219,199,0.12)";
              ctx.fillRect(tx + ts * 0.2, ty + ts * 0.32, 2, 1);
            }
          } else if (map.style === "ruins") {
            if (n0 > 0.72) {
              ctx.fillStyle = "rgba(210,201,181,0.12)";
              ctx.fillRect(tx + ts * 0.22, ty + ts * 0.28, 2, 2);
              ctx.fillRect(tx + ts * 0.58, ty + ts * 0.61, 2, 2);
            }
            if (n1 < 0.14) {
              ctx.strokeStyle = "rgba(53,47,41,0.24)";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(tx + ts * 0.16, ty + ts * 0.68);
              ctx.lineTo(tx + ts * 0.4, ty + ts * 0.44);
              ctx.lineTo(tx + ts * 0.74, ty + ts * 0.62);
              ctx.stroke();
            }
            if (n2 > 0.86) {
              ctx.fillStyle = "rgba(82,74,65,0.12)";
              ctx.fillRect(tx + ts * 0.7, ty + ts * 0.24, 2, 2);
            }
          } else if (map.style === "citadel") {
            if (n0 > 0.8) {
              ctx.strokeStyle = "rgba(170,142,205,0.16)";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(tx + ts * 0.22, ty + ts * 0.24);
              ctx.lineTo(tx + ts * 0.68, ty + ts * 0.7);
              ctx.stroke();
            }
          }
        }
      }

      if (map.style === "forest") {
        const fog = ctx.createLinearGradient(0, 0, 0, map.heightPx);
        fog.addColorStop(0, "rgba(189,220,153,0.05)");
        fog.addColorStop(1, "rgba(62,99,59,0.02)");
        ctx.fillStyle = fog;
        ctx.fillRect(0, 0, map.widthPx, map.heightPx);
      } else if (map.style === "swamp") {
        const damp = ctx.createLinearGradient(0, 0, map.widthPx, map.heightPx);
        damp.addColorStop(0, "rgba(129,171,160,0.04)");
        damp.addColorStop(1, "rgba(34,64,61,0.08)");
        ctx.fillStyle = damp;
        ctx.fillRect(0, 0, map.widthPx, map.heightPx);
      } else if (map.style === "ruins") {
        const dust = ctx.createLinearGradient(0, 0, map.widthPx, map.heightPx);
        dust.addColorStop(0, "rgba(212,198,166,0.04)");
        dust.addColorStop(1, "rgba(110,98,81,0.06)");
        ctx.fillStyle = dust;
        ctx.fillRect(0, 0, map.widthPx, map.heightPx);
      }
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

    drawObstacleProps(map, palette) {
      const { ctx } = this;
      const props = (map.obstacleProps || []).slice().sort((a, b) => (a.depthY || a.y + a.h) - (b.depthY || b.y + b.h));
      const tone = this.propToneByStyle[map.style] || this.propToneByStyle.forest;

      for (const prop of props) {
        const c = prop.collider;
        if (c) {
          const baseX = c.x + c.w * 0.5;
          const baseY = c.y + c.h * 0.9;
          ctx.fillStyle = tone.ground;
          ctx.beginPath();
          ctx.ellipse(
            baseX,
            baseY,
            Math.max(11, c.w * 0.78),
            Math.max(7, c.h * 0.38),
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();

          ctx.fillStyle = "rgba(0, 0, 0, 0.09)";
          ctx.beginPath();
          ctx.ellipse(
            baseX,
            baseY + 1,
            Math.max(7, c.w * 0.48),
            Math.max(4, c.h * 0.16),
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();

          ctx.strokeStyle = tone.edge;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.ellipse(baseX, baseY, Math.max(9, c.w * 0.6), Math.max(6, c.h * 0.28), 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        const img = CG.SpriteSystem.getImage(prop.path);
        if (img && img.complete && img.naturalWidth > 0) {
          const drawW = Math.round(prop.w);
          const drawH = Math.round(prop.h);
          const drawX = Math.round(prop.x);
          const drawY = Math.round(prop.y);
          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          ctx.save();
          ctx.globalCompositeOperation = "source-atop";
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = tone.tint;
          ctx.fillRect(drawX, drawY, drawW, drawH);
          ctx.globalCompositeOperation = "multiply";
          ctx.globalAlpha = 0.42;
          ctx.fillStyle = tone.shade;
          ctx.fillRect(drawX, drawY, drawW, drawH);
          ctx.restore();

          continue;
        }

        if (c) {
          ctx.fillStyle = palette ? palette.wall[1] : "rgba(70, 90, 70, 0.65)";
          ctx.fillRect(c.x, c.y, c.w, c.h);
          ctx.strokeStyle = tone.edge;
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
      const t = performance.now() * 0.0026;
      const sway = Math.sin(t) * 1.4;
      const lantern = 1 + Math.sin(t * 1.8) * 0.14;

      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(m.x, m.y + m.radius * 1.02, m.radius * 1.8, m.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#654833";
      ctx.fillRect(m.x - 34, m.y + 3, 68, 20);

      ctx.fillStyle = "#775741";
      ctx.fillRect(m.x - 30, m.y + 3, 10, 20);
      ctx.fillRect(m.x + 20, m.y + 3, 10, 20);

      ctx.fillStyle = "#8b3e36";
      ctx.beginPath();
      ctx.moveTo(m.x - 40, m.y + 2);
      ctx.lineTo(m.x - 28, m.y - 22);
      ctx.lineTo(m.x + 28, m.y - 22);
      ctx.lineTo(m.x + 40, m.y + 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(255,232,186,0.55)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(m.x - 30, m.y - 10);
      ctx.lineTo(m.x + 30, m.y - 10);
      ctx.stroke();

      ctx.fillStyle = "#2f3f62";
      ctx.beginPath();
      ctx.ellipse(m.x + sway * 0.5, m.y - 2, 10, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f2d6b3";
      ctx.beginPath();
      ctx.arc(m.x + sway, m.y - 8, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8c69a";
      ctx.fillRect(m.x - 3 + sway, m.y - 3, 6, 6);

      ctx.strokeStyle = "#ffd88d";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(m.x - 46, m.y - 3, 6.5 * lantern, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,216,141,${0.24 + 0.16 * lantern})`;
      ctx.beginPath();
      ctx.arc(m.x - 46, m.y - 3, 11 * lantern, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#6c4d39";
      ctx.fillRect(m.x + 36, m.y + 7, 12, 12);
      ctx.fillRect(m.x + 50, m.y + 10, 10, 9);

      ctx.strokeStyle = "rgba(255,198,120,0.65)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(m.x, m.y - 2, m.radius + 9, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffe7b7";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("营地商人", m.x, m.y - m.radius - 12);
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
      ctx.fillText(game.singlePlayerMode ? "冒险框架（单人）" : "双人冒险框架", this.canvas.width / 2, 130);

      if (game.singlePlayerMode) {
        this.drawClassCard(this.canvas.width / 2, 250, "P1", game.selected.p1);
        return;
      }

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
      const tip =
        game.state === GAME_STATES.GAME_OVER && !game.scoreSubmitted
          ? "请先提交名称成绩，再按 Enter 回到职业选择"
          : "按 Enter 回到职业选择";
      ctx.fillText(tip, this.canvas.width / 2, this.canvas.height / 2 + 36);
    }
  }

  CG.Renderer = Renderer;
})();
