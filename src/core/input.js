(() => {
  const CG = (window.CoopGame = window.CoopGame || {});

  class Input {
    constructor() {
      this.down = new Set();
      this.pressed = new Set();
      this.virtualDown = new Set();
      this.virtualPressed = new Set();

      window.addEventListener("keydown", (e) => {
        if (!this.down.has(e.code)) this.pressed.add(e.code);
        this.down.add(e.code);
      });

      window.addEventListener("keyup", (e) => {
        this.down.delete(e.code);
      });

      window.addEventListener("blur", () => {
        this.down.clear();
        this.pressed.clear();
        this.virtualDown.clear();
        this.virtualPressed.clear();
      });
    }

    isDown(code) {
      return this.down.has(code) || this.virtualDown.has(code);
    }

    consume(code) {
      if (this.pressed.has(code)) {
        this.pressed.delete(code);
        return true;
      }
      if (this.virtualPressed.has(code)) {
        this.virtualPressed.delete(code);
        return true;
      }
      return false;
    }

    setVirtualDown(code, active) {
      if (!code) return;
      if (active) {
        if (!this.virtualDown.has(code)) this.virtualPressed.add(code);
        this.virtualDown.add(code);
        return;
      }
      this.virtualDown.delete(code);
    }

    tapVirtual(code) {
      if (!code) return;
      this.virtualPressed.add(code);
    }

    endFrame() {
      this.pressed.clear();
      this.virtualPressed.clear();
    }
  }

  CG.Input = Input;
})();
