const vscode = require('vscode')

class TypingDrivenSnow {
  constructor(snowfall) {
    this.snowfall = snowfall
    this.enabled = false
    this.speedSensitivity = 3
    this.lastKeyTime = 0
    this.typingRate = 0
    this.typingDisposable = null
  }

  loadConfig(cfg) {
    this.enabled = cfg.get('snowfall.typingDriven', false)
    this.speedSensitivity = Math.max(0.1, Math.min(10, cfg.get('snowfall.speedSensitivity', 3)))
  }

  start() {
    if (this.typingDisposable) this.typingDisposable.dispose()
    this.lastKeyTime = 0
    this.typingRate = 0
    this.typingDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
      if (!this.enabled) return
      if (!event.contentChanges.length) return
      const change = event.contentChanges[0]
      if (change.text.length !== 1 || change.text === '\n' || change.text === '\r\n') return
      this.onKeyTyped()
    })
  }

  stop() {
    if (this.typingDisposable) { this.typingDisposable.dispose(); this.typingDisposable = null }
    this.lastKeyTime = 0
    this.typingRate = 0
  }

  onKeyTyped() {
    const now = Date.now()
    if (this.lastKeyTime) {
      const dt = (now - this.lastKeyTime) / 1000
      this.typingRate = dt > 0 ? 1 / dt : 0
    }
    this.lastKeyTime = now
    vscode.window.visibleTextEditors.forEach(editor => {
      const key = this.snowfall.editorKey(editor)
      const model = this.snowfall.editors.get(key)
      if (!model) return
      const vis = editor.visibleRanges[0]
      const top = vis?.start?.line ?? 0
      const maxCols = model.maxColumns || 80
      model.flakes.push({
        x: Math.random() * maxCols,
        y: top - Math.random() * 2,
        baseSize: this.snowfall.size * (0.75 + Math.random() * 0.75),
        sizePhase: Math.random() * Math.PI * 2,
        sizeSpeed: 0.5 + Math.random() * 1.5,
        sizeAmp: 0.25 + Math.random() * 0.35,
        size: this.snowfall.size * (0.75 + Math.random() * 0.75),
        opacity: 0.6 + Math.random() * 0.4,
        v: this.getTypingDrivenSpeed()
      })
      if (model.flakes.length > this.snowfall.density) model.flakes.splice(0, model.flakes.length - this.snowfall.density)
      this.snowfall.renderEditor(editor, model)
    })
  }

  getTypingDrivenSpeed() {
    return this.snowfall.speed + (this.typingRate * this.speedSensitivity)
  }
}

module.exports = TypingDrivenSnow
