(() => {
  const CG = (window.CoopGame = window.CoopGame || {});
  const { CANVAS_WIDTH, CANVAS_HEIGHT } = CG.CONSTANTS;

  const canvas = document.getElementById("game");
  const statusLine = document.getElementById("statusLine");
  const helpPanel = document.getElementById("helpPanel");

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  try {
    new CG.Game(canvas, statusLine, helpPanel);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    statusLine.textContent = `脚本启动失败: ${msg}`;
    console.error(err);
  }
})();
