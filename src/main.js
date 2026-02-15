(() => {
  const CG = (window.CoopGame = window.CoopGame || {});
  const { CANVAS_WIDTH, CANVAS_HEIGHT } = CG.CONSTANTS;

  const canvas = document.getElementById("game");
  const gameShell = document.querySelector(".game-shell");
  const statusLine = document.getElementById("statusLine");
  const helpPanel = document.getElementById("helpPanel");
  const gameOverPanel = document.getElementById("gameOverPanel");
  const mobileControlsRoot = document.getElementById("mobileControls");
  const rotateHint = document.getElementById("rotateHint");
  const ua = window.navigator.userAgent || "";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const mobileMode = uaMobile || (coarse && Math.min(window.innerWidth, window.innerHeight) <= 900);

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const fitGameShell = () => {
    if (!gameShell) return;
    if (!document.body.classList.contains("mobile-mode")) {
      gameShell.style.width = "";
      return;
    }

    const ratio = CANVAS_WIDTH / CANVAS_HEIGHT;
    const headerH = document.querySelector(".hud-top")?.offsetHeight || 0;
    const rankVisible = gameOverPanel && !gameOverPanel.classList.contains("hidden");
    const rankH = rankVisible ? Math.min(gameOverPanel.offsetHeight, Math.floor(window.innerHeight * 0.36)) : 0;
    const availableW = Math.max(220, window.innerWidth - 16);
    const availableH = Math.max(160, window.innerHeight - headerH - rankH - 20);
    const fitW = Math.min(availableW, Math.floor(availableH * ratio));
    gameShell.style.width = `${fitW}px`;
  };

  try {
    const game = new CG.Game(canvas, statusLine, helpPanel, gameOverPanel, {
      singlePlayer: mobileMode,
    });
    if (CG.MobileControls) {
      new CG.MobileControls(game, mobileControlsRoot, rotateHint);
    }
    fitGameShell();
    window.addEventListener("resize", fitGameShell, { passive: true });
    window.addEventListener("orientationchange", fitGameShell, { passive: true });
    if (gameOverPanel) {
      new MutationObserver(() => fitGameShell()).observe(gameOverPanel, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    statusLine.textContent = `脚本启动失败: ${msg}`;
    console.error(err);
  }
})();
