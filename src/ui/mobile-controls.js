(() => {
  const CG = (window.CoopGame = window.CoopGame || {});

  class MobileControls {
    constructor(game, root, rotateHint) {
      this.game = game;
      this.input = game?.input;
      this.root = root;
      this.rotateHint = rotateHint;
      this.activeHoldCodes = new Set();
      this.locked = false;
      const ua = window.navigator.userAgent || "";
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
      this.touchDevice = uaMobile || (coarse && Math.min(window.innerWidth, window.innerHeight) <= 900);

      if (!this.input || !this.root || !this.touchDevice) {
        if (this.root) this.root.classList.add("hidden");
        if (this.rotateHint) this.rotateHint.classList.add("hidden");
        return;
      }

      document.body.classList.add("mobile-mode");
      this.render();
      this.bindButtons();
      this.syncOrientation();
      this.syncGameState();
      this.onResize = this.syncOrientation.bind(this);
      window.addEventListener("resize", this.onResize, { passive: true });
      window.addEventListener("orientationchange", this.onResize, { passive: true });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.releaseHeldButtons();
      });
      this.stateLoop = () => {
        this.syncGameState();
        window.requestAnimationFrame(this.stateLoop);
      };
      window.requestAnimationFrame(this.stateLoop);
    }

    render() {
      this.root.innerHTML = `
        <div class="mc-top-row">
          <button class="mc-btn tap" data-tap="KeyQ">武士</button>
          <button class="mc-btn tap" data-tap="KeyW">弓箭手</button>
          <button class="mc-btn tap" data-tap="KeyE">魔法师</button>
          <button class="mc-btn tap main" data-tap="Enter">开始/继续</button>
        </div>
        <div class="mc-bottom-row single">
          <section class="mc-zone p1">
            <div class="mc-label">P1</div>
            <div class="mc-dpad">
              <button class="mc-btn hold up" data-hold="KeyW">▲</button>
              <button class="mc-btn hold left" data-hold="KeyA">◀</button>
              <button class="mc-btn hold right" data-hold="KeyD">▶</button>
              <button class="mc-btn hold down" data-hold="KeyS">▼</button>
            </div>
            <div class="mc-actions">
              <button class="mc-btn tap primary" data-tap="KeyF">攻</button>
              <button class="mc-btn tap" data-tap="KeyG">滚</button>
              <button class="mc-btn tap" data-tap="KeyR">技</button>
              <button class="mc-btn tap" data-tap="KeyT">疗</button>
              <button class="mc-btn tap" data-tap="KeyE">交</button>
              <button class="mc-btn tap" data-tap="KeyC">选◀</button>
              <button class="mc-btn tap" data-tap="KeyV">选▶</button>
              <button class="mc-btn tap" data-tap="KeyB">装</button>
              <button class="mc-btn tap" data-tap="KeyX">丢</button>
            </div>
          </section>
        </div>
      `;
      this.root.classList.remove("hidden");
    }

    bindButtons() {
      const tapButtons = this.root.querySelectorAll("[data-tap]");
      for (const btn of tapButtons) {
        const code = btn.getAttribute("data-tap");
        btn.addEventListener("contextmenu", (e) => e.preventDefault());
        btn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (this.locked) return;
          this.input.tapVirtual(code);
          btn.classList.add("active");
        });
        const clear = () => btn.classList.remove("active");
        btn.addEventListener("pointerup", clear);
        btn.addEventListener("pointercancel", clear);
        btn.addEventListener("pointerleave", clear);
      }

      const holdButtons = this.root.querySelectorAll("[data-hold]");
      for (const btn of holdButtons) {
        const code = btn.getAttribute("data-hold");
        let down = false;
        const release = () => {
          if (!down) return;
          down = false;
          this.activeHoldCodes.delete(code);
          this.input.setVirtualDown(code, false);
          btn.classList.remove("active");
        };

        btn.addEventListener("contextmenu", (e) => e.preventDefault());
        btn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (this.locked) return;
          down = true;
          this.activeHoldCodes.add(code);
          this.input.setVirtualDown(code, true);
          btn.classList.add("active");
        });
        btn.addEventListener("pointerup", release);
        btn.addEventListener("pointercancel", release);
        btn.addEventListener("pointerleave", release);
      }
    }

    releaseHeldButtons() {
      for (const code of this.activeHoldCodes) {
        this.input.setVirtualDown(code, false);
      }
      this.activeHoldCodes.clear();
      for (const btn of this.root.querySelectorAll(".mc-btn.active")) {
        btn.classList.remove("active");
      }
    }

    syncOrientation() {
      const isLandscape = window.innerWidth >= window.innerHeight;
      this.locked = !isLandscape;
      this.root.classList.toggle("locked", this.locked);
      if (this.rotateHint) this.rotateHint.classList.toggle("hidden", isLandscape);
      if (this.locked) this.releaseHeldButtons();
    }

    syncGameState() {
      const state = this.game?.state;
      const playing = state === CG.CONSTANTS?.GAME_STATES?.PLAYING;
      this.root.classList.toggle("menu-state", !playing);
    }
  }

  CG.MobileControls = MobileControls;
})();
