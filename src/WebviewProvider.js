const vscode = require('vscode')
const path = require('path')

class HappyImageViewProvider {
  /** @param {vscode.ExtensionContext} context */
  constructor(context) {
    this.context = context
  }

  /** @param {vscode.WebviewView} webviewView */
  resolveWebviewView(webviewView) {
    webviewView.webview.options = {
      enableScripts: true
    }
    const imgPath = webviewView.webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'happy.png')))
    webviewView.webview.html = this.#html(imgPath)
  }

  #html(src) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    html, body { padding: 0; margin: 0; background: transparent; }
    body { display: flex; flex-direction: column; align-items: center; font-family: system-ui, sans-serif; position: relative; }
  .wrap { width: 100vw; height: 100vh; padding: 0; margin: 0; box-sizing: border-box; position: relative; z-index: 1; overflow: hidden; }
  img { width: 100%; height: 100%; object-fit: contain; display: block; image-rendering: -webkit-optimize-contrast; z-index: 1; background: transparent; }
  .wrap { display: flex; align-items: center; justify-content: center; }
    h2 { font-size: 13px; font-weight: 600; margin: 4px 0 8px; text-align: center; }
    canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; }
  </style>
  <title>Happy</title>
</head>
<body>
  <div class="wrap">
  <img src="${src}" alt="Happy" />
    <canvas id="snow"></canvas>
  </div>
  <script>
    const canvas = document.getElementById('snow');
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0;
    function resize() {
      W = canvas.width = canvas.clientWidth = window.innerWidth;
      H = canvas.height = canvas.clientHeight = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();
    // Snowflake state
    const flakes = [];
  const DENSITY = 80;
    function spawnFlake() {
      return {
        x: Math.random() * W,
        y: -10 - Math.random() * 40,
        r: 6 + Math.random() * 8,
        v: 0.7 + Math.random() * 1.2,
        a: 0.5 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        drift: 0.3 + Math.random() * 0.7
      };
    }
    function ensureFlakes() {
      while (flakes.length < DENSITY) flakes.push(spawnFlake());
      if (flakes.length > DENSITY) flakes.splice(DENSITY);
    }
    function tick() {
      ensureFlakes();
      ctx.clearRect(0,0,W,H);
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flakes) {
        f.y += f.v;
        f.x += Math.sin(f.phase) * f.drift;
        f.phase += 0.01 + Math.random() * 0.02;
        if (f.y - f.r > H) { f.y = -f.r; f.x = Math.random()*W; }
        if (f.x < -20) f.x = W + 20; else if (f.x > W + 20) f.x = -20;
        const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        grd.addColorStop(0, 'rgba(180,220,255,' + (0.9 * f.a) + ')');
        grd.addColorStop(1, 'rgba(180,220,255,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    tick();
  </script>
</body>
</html>`
  }
}

module.exports = HappyImageViewProvider
