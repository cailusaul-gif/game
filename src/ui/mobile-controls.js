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
      this.isIOS = /iPhone|iPad|iPod/i.test(ua);
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
        <button class="mc-btn mc-fs" data-role="fullscreen">全屏</button>
        <div class="mc-top-row">
          <button class="mc-btn tap" data-tap="KeyQ">武士</button>
          <button class="mc-btn tap" data-tap="KeyW">弓箭手</button>
          <button class="mc-btn tap" data-tap="KeyE">魔法师</button>
          <button class="mc-btn tap main" data-tap="Enter">开始/继续</button>
        </div>
        <div class="mc-bottom-row">
          <section class="mc-left">
            <div class="mc-dpad">
              <button class="mc-btn hold up" data-hold="KeyW">▲</button>
              <button class="mc-btn hold left" data-hold="KeyA">◀</button>
              <button class="mc-btn hold right" data-hold="KeyD">▶</button>
              <button class="mc-btn hold down" data-hold="KeyS">▼</button>
            </div>
          </section>
          <section class="mc-right">
            <div class="mc-actions compact">
              <button class="mc-btn tap primary" data-tap="KeyF">攻</button>
              <button class="mc-btn tap" data-tap="KeyG">滚</button>
              <button class="mc-btn tap" data-tap="KeyR">技</button>
              <button class="mc-btn tap" data-role="utility" data-tap="KeyT">疗</button>
            </div>
          </section>
        </div>
      `;
      this.utilityBtn = this.root.querySelector('[data-role="utility"]');
      this.fullscreenBtn = this.root.querySelector('[data-role="fullscreen"]');
      this.root.classList.remove("hidden");
    }

    bindButtons() {
      const tapButtons = this.root.querySelectorAll("[data-tap]");
      for (const btn of tapButtons) {
        btn.addEventListener("contextmenu", (e) => e.preventDefault());
        btn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (this.locked) return;
          const code = btn.getAttribute("data-tap");
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

      if (this.fullscreenBtn) {
        const clear = () => this.fullscreenBtn.classList.remove("active");
        this.fullscreenBtn.addEventListener("contextmenu", (e) => e.preventDefault());
        this.fullscreenBtn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (this.locked) return;
          this.fullscreenBtn.classList.add("active");
          if (this.isIOS && !this.canNativeFullscreen() && !this.isStandaloneMode()) {
            this.showFullscreenHint("分享 -> 添加到主屏幕");
            return;
          }
          this.toggleFullscreen();
        });
        this.fullscreenBtn.addEventListener("pointerup", clear);
        this.fullscreenBtn.addEventListener("pointercancel", clear);
        this.fullscreenBtn.addEventListener("pointerleave", clear);
      }

      const sync = this.syncFullscreenLabel.bind(this);
      document.addEventListener("fullscreenchange", sync);
      document.addEventListener("webkitfullscreenchange", sync);
      sync();
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
      if (isLandscape) {
        window.setTimeout(() => window.scrollTo(0, 1), 60);
      }
    }

    syncGameState() {
      const state = this.game?.state;
      const playing = state === CG.CONSTANTS?.GAME_STATES?.PLAYING;
      this.root.classList.toggle("menu-state", !playing);

      if (this.utilityBtn) {
        const inCamp = !!this.game?.currentRoom?.isCamp;
        this.utilityBtn.setAttribute("data-tap", inCamp ? "KeyE" : "KeyT");
        this.utilityBtn.textContent = inCamp ? "交" : "疗";
      }
    }

    isFullscreen() {
      return !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );
    }

    canNativeFullscreen() {
      const el = document.documentElement;
      return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen);
    }

    isStandaloneMode() {
      return !!(
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true
      );
    }

    async toggleFullscreen() {
      if (!this.canNativeFullscreen()) {
        if (this.isStandaloneMode()) {
          this.showFullscreenHint("已是主屏全屏模式");
        } else {
          this.showFullscreenHint(this.isIOS ? "分享 -> 添加到主屏幕" : "请用浏览器菜单全屏");
        }
        return;
      }

      if (this.isFullscreen()) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
        return;
      }

      const el = document.documentElement;
      try {
        if (el.requestFullscreen) {
          try {
            await el.requestFullscreen({ navigationUI: "hide" });
          } catch (_err) {
            await el.requestFullscreen();
          }
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
          el.msRequestFullscreen();
        } else {
          this.showFullscreenHint("浏览器不支持全屏");
        }
      } catch (_err) {
        this.showFullscreenHint(this.isIOS ? "分享 -> 添加到主屏幕" : "请用浏览器菜单全屏");
      }
    }

    syncFullscreenLabel() {
      if (!this.fullscreenBtn) return;
      if (this.isIOS && !this.canNativeFullscreen() && !this.isStandaloneMode()) {
        this.fullscreenBtn.textContent = "加到主屏";
        return;
      }
      this.fullscreenBtn.textContent = this.isFullscreen() ? "退出全屏" : "全屏";
    }

    showFullscreenHint(text) {
      if (!this.fullscreenBtn) return;
      this.fullscreenBtn.textContent = text;
      window.setTimeout(() => this.syncFullscreenLabel(), 1400);
    }
  }

  CG.MobileControls = MobileControls;
})();
