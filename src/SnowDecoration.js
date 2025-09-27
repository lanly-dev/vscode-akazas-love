
const vscode = require('vscode')


class SnowDecoration {
  constructor() {
    this.editors = new Map() // key: editor id -> { flakes: [], decType, maxColumns }
    this.timer = null
    this.enabled = false
  }

  /** Start snow animation (normal snow) */
  start({ color, size, speed, density }) {
    console.log('SnowDecoration start with', { color, size, speed, density })
    if (this.timer) return
    this.enabled = true
    this.#resetEditors(color, size, density)
    const fps = 30
    const dt = 1 / fps
    this.timer = setInterval(() => this.#tick(dt, color, size, speed), Math.floor(1000 / fps))
  }

  /** Stop snow animation and clear decorations */
  stop() {
    this.enabled = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    for (const { decType } of this.editors.values()) 
      decType.dispose()
    
    this.editors.clear()
  }

  /** Render snowflakes in the given editor using the provided model. */
  renderEditor(editor, model, color, size) {
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
      const scale = Math.max(0.3, flake.size / size)
      opts.push({
        range,
        renderOptions: {
          before: {
            contentText: '❄',
            color: this.#rgba(color, flake.opacity),
            textDecoration: `none; position: absolute; left: 0; transform: translateX(${col}ch) scale(${scale.toFixed(3)}); transform-origin: top left; pointer-events: none;`
          }
        }
      })
    }
    editor.setDecorations(model.decType, opts)
  }

  // --- Utility methods ---
  #resetEditors(color, size, density) {
    for (const { decType } of this.editors.values()) decType.dispose()
    this.editors.clear()
    vscode.window.visibleTextEditors.forEach(editor => {
      const decType = vscode.window.createTextEditorDecorationType({
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        before: {
          contentText: '❄',
          color,
          fontWeight: 'normal'
        }
      })
      const key = editor.document.uri.toString()
      const model = { decType, flakes: [], maxColumns: 80 }
      this.editors.set(key, model)
      // You may want to spawn flakes here
    })
  }

  #tick(dt, color, size, speed) {
    if (!this.enabled) return
    vscode.window.visibleTextEditors.forEach(editor => {
      const key = editor.document.uri.toString()
      const model = this.editors.get(key)
      if (!model) return
      // Move flakes, animate, and render
      // ... (flake logic omitted for brevity)
      this.renderEditor(editor, model, color, size)
    })
  }

  /**
   * Utility: check if a character at idx in text is whitespace or beyond EOL
   */
  #isWhitespaceAt(text, idx) {
    if (idx >= text.length) return true
    const ch = text[idx]
    return /\s/.test(ch)
  }

  /**
   * Utility: convert hex or rgba color to rgba with opacity
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