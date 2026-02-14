(() => {
  const CG = (window.CoopGame = window.CoopGame || {});

  class Entity {
    constructor(x, y, radius) {
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.alive = true;
    }
  }

  CG.Entity = Entity;
})();
