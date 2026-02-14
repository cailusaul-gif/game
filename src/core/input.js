(() => {
  const CG = (window.CoopGame = window.CoopGame || {});

  class Input {
    constructor() {
      this.down = new Set();
      this.pressed = new Set();

      window.addEventListener("keydown", (e) => {
        if (!this.down.has(e.code)) this.pressed.add(e.code);
        this.down.add(e.code);
      });

      window.addEventListener("keyup", (e) => {
        this.down.delete(e.code);
      });
    }

    isDown(code) {
      return this.down.has(code);
    }

    consume(code) {
      if (!this.pressed.has(code)) return false;
      this.pressed.delete(code);
      return true;
    }

    endFrame() {
      this.pressed.clear();
    }
  }

  CG.Input = Input;
})();
