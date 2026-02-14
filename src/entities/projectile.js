(() => {
  const CG = (window.CoopGame = window.CoopGame || {});

  class Projectile extends CG.Entity {
    constructor(x, y, vx, vy, options) {
      super(x, y, options.radius || 4);
      this.vx = vx;
      this.vy = vy;
      this.owner = options.owner;
      this.damage = options.damage;
      this.ttl = options.ttl;
      this.color = options.color;
      this.splash = options.splash || 0;
      this.sourcePlayer = options.sourcePlayer || null;
      this.sourceEnemy = options.sourceEnemy || null;
      this.forceCrit = options.forceCrit || false;
      this.noLifesteal = options.noLifesteal || false;
      this.isProc = options.isProc || false;
      this.onEnemyHit = options.onEnemyHit || null;
      this.onPlayerHit = options.onPlayerHit || null;
      this.visual = options.visual || "orb";
      this.trailColor = options.trailColor || null;
    }

    update(dt, game) {
      if (!this.alive) return;

      this.ttl -= dt;
      if (this.ttl <= 0) {
        this.alive = false;
        return;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (CG.Collision.circleCollidesWithMap(game.currentMap, this.x, this.y, this.radius)) {
        this.alive = false;
        return;
      }

      if (this.owner === "player") {
        for (const enemy of game.enemies) {
          if (!enemy.alive) continue;
          if (Math.hypot(enemy.x - this.x, enemy.y - this.y) > enemy.radius + this.radius) continue;

          const damageDone = this.sourcePlayer
            ? this.sourcePlayer.dealDamage(enemy, this.damage, game, {
                forceCrit: this.forceCrit,
                noLifesteal: this.noLifesteal,
                isProc: this.isProc,
              })
            : enemy.takeDamage(this.damage, { game });

          if (typeof this.onEnemyHit === "function") {
            this.onEnemyHit(enemy, game, damageDone);
          }
          if (this.splash > 0) {
            for (const around of game.enemies) {
              if (!around.alive || around === enemy) continue;
              const d = Math.hypot(around.x - this.x, around.y - this.y);
              if (d <= this.splash + around.radius) {
                if (this.sourcePlayer) {
                  this.sourcePlayer.dealDamage(around, Math.floor(this.damage * 0.5), game, {
                    forceCrit: false,
                    noLifesteal: true,
                    isProc: true,
                  });
                } else {
                  around.takeDamage(Math.floor(this.damage * 0.5), { game });
                }
              }
            }

            game.effects.push({
              kind: "circle",
              x: this.x,
              y: this.y,
              r: this.splash,
              t: 0.16,
              color: "rgba(142,197,255,0.4)",
            });
          }

          this.alive = false;
          if (damageDone > 0) {
            game.effects.push({
              kind: "hit",
              x: enemy.x,
              y: enemy.y,
              r: enemy.radius + 6,
              t: 0.08,
              color: "rgba(255,255,255,0.35)",
            });
          }
          break;
        }
      } else {
        for (const p of game.players) {
          if (!p.alive) continue;
          if (Math.hypot(p.x - this.x, p.y - this.y) <= p.radius + this.radius) {
            p.takeDamage(this.damage, { sourceEnemy: this.sourceEnemy, game });
            if (typeof this.onPlayerHit === "function") {
              this.onPlayerHit(p, game);
            }
            this.alive = false;
            break;
          }
        }
      }
    }

    draw(ctx) {
      const angle = Math.atan2(this.vy, this.vx);
      const spin = performance.now() * 0.012;

      if (this.visual === "arrow" || this.visual === "enemy_spear") {
        const len = this.radius * 3.4;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        ctx.strokeStyle = this.visual === "enemy_spear" ? "#ffd9df" : "#d7b67a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-len * 0.6, 0);
        ctx.lineTo(len * 0.2, 0);
        ctx.stroke();

        ctx.fillStyle = this.visual === "enemy_spear" ? "#ff8ca0" : "#f0efe7";
        ctx.beginPath();
        ctx.moveTo(len * 0.2, 0);
        ctx.lineTo(-len * 0.08, -this.radius * 0.75);
        ctx.lineTo(-len * 0.08, this.radius * 0.75);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = this.visual === "enemy_spear" ? "#ffe5ea" : "#86a8c2";
        ctx.beginPath();
        ctx.moveTo(-len * 0.62, 0);
        ctx.lineTo(-len * 0.94, -this.radius * 0.45);
        ctx.lineTo(-len * 0.94, this.radius * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
      }

      if (this.visual === "star_lance" || this.visual === "boss_lance") {
        const len = this.radius * 3.9;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        ctx.strokeStyle = this.visual === "boss_lance" ? "#ffe3f4" : "#d8f6ff";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-len * 0.55, 0);
        ctx.lineTo(len * 0.5, 0);
        ctx.stroke();

        ctx.fillStyle = this.visual === "boss_lance" ? "#ff8fbd" : "#7ad8ff";
        ctx.beginPath();
        ctx.moveTo(len * 0.65, 0);
        ctx.lineTo(len * 0.2, -this.radius * 0.95);
        ctx.lineTo(len * 0.2, this.radius * 0.95);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
      }

      if (this.visual === "blade_wave" || this.visual === "shadow_blade") {
        const arc = this.visual === "shadow_blade" ? 0.95 : 1.18;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        ctx.strokeStyle = this.visual === "shadow_blade" ? "#c99bff" : "#dff4ff";
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 2.2, -arc, arc);
        ctx.stroke();
        ctx.strokeStyle = this.visual === "shadow_blade" ? "rgba(92,57,156,0.62)" : "rgba(112,188,222,0.58)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(this.radius * 0.2, 0, this.radius * 1.45, -arc * 0.78, arc * 0.78);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (this.visual === "rune_disc" || this.visual === "void_spike") {
        const isVoid = this.visual === "void_spike";
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(spin + angle * 0.2);
        ctx.strokeStyle = isVoid ? "#cf9dff" : "#98edff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 1.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < 4; i += 1) {
          const a = (Math.PI * 2 * i) / 4;
          const r = this.radius * (isVoid ? 1.55 : 1.35);
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (this.visual === "magic_orb" || this.visual === "arcane_orb" || this.visual === "enemy_arcane") {
        const g = ctx.createRadialGradient(
          this.x - this.radius * 0.35,
          this.y - this.radius * 0.35,
          this.radius * 0.2,
          this.x,
          this.y,
          this.radius * 1.45
        );
        const c0 = this.visual === "enemy_arcane" ? "#f6d1ff" : this.visual === "arcane_orb" ? "#daf6ff" : "#d8ecff";
        const c1 = this.visual === "enemy_arcane" ? "#a359d8" : this.visual === "arcane_orb" ? "#76d3ff" : "#5ca9ff";
        g.addColorStop(0, c0);
        g.addColorStop(1, `${c1}00`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 1.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = c1;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.92, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }

      if (this.visual === "plasma_orb") {
        const g = ctx.createRadialGradient(
          this.x,
          this.y,
          this.radius * 0.2,
          this.x,
          this.y,
          this.radius * 1.8
        );
        g.addColorStop(0, "#fff8d9");
        g.addColorStop(0.5, "#ffbf63");
        g.addColorStop(1, "rgba(255,120,70,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(spin);
        ctx.strokeStyle = "rgba(255,235,183,0.85)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-this.radius * 1.25, 0);
        ctx.lineTo(this.radius * 1.25, 0);
        ctx.moveTo(0, -this.radius * 1.25);
        ctx.lineTo(0, this.radius * 1.25);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (this.visual === "enemy_burst" || this.visual === "enemy_boss_petal") {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        const scale = this.visual === "enemy_boss_petal" ? 1.15 : 1;
        const r = this.radius * scale;
        ctx.fillStyle = this.visual === "enemy_boss_petal" ? "#ff87a7" : "#ffa96f";
        ctx.beginPath();
        ctx.moveTo(r * 1.2, 0);
        ctx.bezierCurveTo(r * 0.3, -r * 0.95, -r * 0.75, -r * 0.6, -r, 0);
        ctx.bezierCurveTo(-r * 0.75, r * 0.6, r * 0.3, r * 0.95, r * 1.2, 0);
        ctx.fill();
        ctx.restore();
        return;
      }

      if (this.visual === "boss_scythe") {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        ctx.strokeStyle = "#ffe2f5";
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(-this.radius * 1.25, 0);
        ctx.lineTo(this.radius * 0.15, 0);
        ctx.stroke();
        ctx.fillStyle = "#ff7eae";
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 1.35, -1.2, 1.2);
        ctx.lineTo(this.radius * 0.15, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
      }

      if (this.visual === "enemy_bolt") {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        ctx.fillStyle = "#ffd88d";
        ctx.beginPath();
        ctx.moveTo(this.radius * 1.3, 0);
        ctx.lineTo(0, -this.radius * 0.72);
        ctx.lineTo(-this.radius * 1.3, 0);
        ctx.lineTo(0, this.radius * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
      }

      if (this.trailColor) {
        ctx.strokeStyle = this.trailColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.vx * 0.02, this.y - this.vy * 0.02);
        ctx.stroke();
      }

      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  CG.Projectile = Projectile;
})();
