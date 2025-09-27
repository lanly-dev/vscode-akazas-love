const vscode = require('vscode')

class SnowDecoration {

  #editors
  #enabled

  #color
  #density
  #size
  #speed

  #timer

  constructor() {
    const cfg = vscode.workspace.getConfiguration('akazas-love.snowConfigs')
    this.#enabled = vscode.workspace.getConfiguration('akazas-love.snowInEditor')
    this.#editors = new Map() // key: editor id -> { flakes: [], decType, maxColumns }

    this.#color = cfg.get('color', '#FFFFFF')
    this.#density = Math.max(1, Math.min(20, cfg.get('density', 5)))
    this.#size = Math.max(4, Math.min(32, cfg.get('size', 12)))
    this.#speed = Math.max(0.1, Math.min(10, cfg.get('speed', 1)))

    this.#timer = null
    this.#setupEditors()
  }

  start() {
    console.log('SnowDecoration start with', this.#color, this.#size, this.#speed, this.#density)
    if (this.#timer) return
    const fps = 30
    const dt = 1 / fps
    this.#timer = setInterval(() => this.#tick(dt, this.#color, this.#size, this.#speed), Math.floor(1000 / fps))
  }

  stop() {
    this.enabled = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    for (const { decType } of this.editors.values()) decType.dispose()
    this.editors.clear()
  }

  #tick() {
    if (!this.enabled) return
    vscode.window.visibleTextEditors.forEach(editor => {
      const key = editor.document.uri.toString()
      const model = this.editors.get(key)
      if (!model) return

      this.#renderEditor(editor, model)
    })
  }

  #setupEditors() {
    vscode.window.visibleTextEditors.forEach(editor => {
      const key = editor.document.uri.toString()
      if (this.#editors.has(key)) return // Already set up
      const decType = vscode.window.createTextEditorDecorationType({
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        before: {
          contentText: '❄',
          color: this.#color,
          fontWeight: 'normal'
        }
      })
      // Spawn flakes for this editor
      const flakes = []
      const lineCount = editor.document.lineCount
      for (let i = 0; i < this.#density; i++) {
        flakes.push({
          x: Math.random() * 80,
          y: Math.random() * lineCount,
          size: this.#size,
          opacity: 0.6 + Math.random() * 0.4
        })
      }
      const model = { decType, flakes, maxColumns: 80 }
      this.#editors.set(key, model)
      this.#renderEditor(editor, model)
    })
  }

  #renderEditor(editor, model) {
    const vis = editor.visibleRanges[0]
    if (!vis) return
    const bottom = vis.end.line
    const opts = []
    for (const flake of model.flakes) {
      const startLine = Math.max(0, Math.min(editor.document.lineCount - 1, Math.floor(flake.y)))
      const col = Math.max(0, Math.round(flake.x))
      let renderLine = -1
      for (let l = startLine; l <= bottom; l++) {
        const text = editor.document.lineAt(l).text
        if (this.#isWhitespaceAt(text, col)) { renderLine = l; break }
      }
      if (renderLine === -1) continue
      const range = new vscode.Range(renderLine, 0, renderLine, 0)
      const scale = Math.max(0.3, flake.size / this.#size)
      opts.push({
        range,
        renderOptions: {
          before: {
            contentText: '❄',
            color: this.#rgba(this.#color, flake.opacity),
            textDecoration: `none; position: absolute; left: 0; transform: translateX(${col}ch) scale(${scale.toFixed(3)}); transform-origin: top left; pointer-events: none;`
          }
        }
      })
    }
    editor.setDecorations(model.decType, opts)
  }

  /**
   * Utility: check if a character at idx in text is whitespace or beyond EOL.
   * @private
   */
  #isWhitespaceAt(text, idx) {
    if (idx >= text.length) return true
    const ch = text[idx]
    return /\s/.test(ch)
  }

  /**
   * Utility: convert hex or rgba color to rgba with opacity.
   * @private
   */
  #rgba(hexOrRgba, opacity) {
    if (typeof hexOrRgba === 'string' && hexOrRgba.startsWith('#')) {
      const hex = hexOrRgba.replace('#', '')
      const a = parseInt(hex.length === 8 ? hex.slice(6, 8) : 'ff', 16) / 255
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const outA = Math.max(0, Math.min(1, a * opacity))
      return `rgba(${r}, ${g}, ${b}, ${outA})`
    }
    return hexOrRgba
  }
}

module.exports = SnowDecoration
