const vscode = require('vscode')
const TypingRate = require('./TypingRate')

class SnowWebView {
  constructor(snowfall) {
    this.snowfall = snowfall
    this.typingDriven = false
    this.speedSensitivity = 3
    this.typingDisposable = null
    this.typingRateUtil = new TypingRate()
  }

  loadConfig() {
    const cfg1 = vscode.workspace.getConfiguration('akazas-love')
    const cfg2 = vscode.workspace.getConfiguration('akazas-love.snowConfigs')
    this.typingDriven = cfg1.get('typingDriven')
    this.speedSensitivity = cfg2.get('speed', 3)
  }

  start() {
    if (this.typingDisposable) this.typingDisposable.dispose()
    this.typingRateUtil = new TypingRate()
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
    this.typingRateUtil = new TypingRate()
  }

  onKeyTyped() {
    this.typingRateUtil.recordKeystroke()
    const rate = this.typingRateUtil.getRate()
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
        v: this.getTypingDrivenSpeed(rate)
      })
      if (model.flakes.length > this.snowfall.density) model.flakes.splice(0, model.flakes.length - this.snowfall.density)
      this.snowfall.renderEditor(editor, model)
    })
  }

  getTypingDrivenSpeed(rate) {
    // Use provided rate or current TypingRate value
    const typingRate = rate !== undefined ? rate : this.typingRateUtil.getRate()
    return this.snowfall.speed + (typingRate * this.speedSensitivity)
  }
}

module.exports = SnowWebView
