(() => {
  const CG = (window.CoopGame = window.CoopGame || {});
  const { SLOT_LABELS } = CG.CONSTANTS;

  class Loot {
    constructor(x, y, item) {
      this.x = x;
      this.y = y;
      this.item = item;
      this.radius = 10;
      this.alive = true;
    }

    update(game) {
      if (!this.alive) return;

      for (const p of game.players) {
        if (!p.alive) continue;
        const dist = Math.hypot(p.x - this.x, p.y - this.y);
        if (dist > p.radius + this.radius + 8) continue;

        const stored = p.addToInventory(this.item);
        if (!stored) {
          game.log = `${p.id} 背包已满，无法拾取 ${this.item.name}`;
          continue;
        }

        this.alive = false;
        const rarityName = this.item.rarity ? this.item.rarity.name : "普通";
        const powerCount = (this.item.powers || []).length;
        game.log = `${p.id} 拾取了[${rarityName}] ${this.item.name}${
          powerCount > 0 ? `（${powerCount}条词缀技能）` : ""
        }（${SLOT_LABELS[this.item.slot]} -> 背包）`;
        break;
      }
    }

    draw(ctx) {
      const rarityColor = this.item?.rarity?.color || "#f4c95d";
      const slot = this.item?.slot || "weapon";
      const pulse = 0.85 + Math.sin(performance.now() * 0.006) * 0.12;
      const r = this.radius;

      ctx.save();
      ctx.translate(this.x, this.y);

      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.beginPath();
      ctx.ellipse(0, r * 0.72, r * 1.05, r * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.28 * pulse;
      ctx.fillStyle = rarityColor;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = "rgba(20,28,38,0.92)";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.94, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = rarityColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
      ctx.stroke();

      if (slot === "weapon") {
        ctx.save();
        ctx.rotate(-0.45);
        ctx.fillStyle = "#dbe9f4";
        ctx.fillRect(-1, -r * 0.5, 2, r * 0.92);
        ctx.fillStyle = "#c69b63";
        ctx.fillRect(-1.5, r * 0.3, 3, r * 0.22);
        ctx.fillRect(-0.9, r * 0.52, 1.8, r * 0.18);
        ctx.restore();
      } else if (slot === "armor") {
        ctx.fillStyle = "#9dc6dc";
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.35);
        ctx.lineTo(-r * 0.2, -r * 0.52);
        ctx.lineTo(r * 0.2, -r * 0.52);
        ctx.lineTo(r * 0.5, -r * 0.35);
        ctx.lineTo(r * 0.38, r * 0.46);
        ctx.lineTo(-r * 0.38, r * 0.46);
        ctx.closePath();
        ctx.fill();
      } else if (slot === "boots") {
        ctx.fillStyle = "#b7d0e2";
        ctx.beginPath();
        ctx.moveTo(-r * 0.38, -r * 0.18);
        ctx.lineTo(-r * 0.06, -r * 0.18);
        ctx.lineTo(0, r * 0.28);
        ctx.lineTo(r * 0.4, r * 0.28);
        ctx.lineTo(r * 0.4, r * 0.48);
        ctx.lineTo(-r * 0.45, r * 0.48);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.strokeStyle = "#dbf2ff";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#8fe5ff";
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.38);
        ctx.lineTo(r * 0.24, 0);
        ctx.lineTo(0, r * 0.38);
        ctx.lineTo(-r * 0.24, 0);
        ctx.closePath();
        ctx.fill();
      }

      if ((this.item?.powers || []).length > 0) {
        ctx.fillStyle = "#fff4a6";
        ctx.beginPath();
        ctx.arc(r * 0.56, -r * 0.56, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  CG.Loot = Loot;
})();
