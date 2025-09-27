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
    this.#enabled = vscode
    this.#editors = new Map() // key: editor id -> { flakes: [], decType, maxColumns }

    this.#color = cfg.get('color', '#FFFFFF')
    this.#density = Math.max(1, Math.min(20, cfg.get('density', 5)))
    this.#size = Math.max(4, Math.min(32, cfg.get('size', 12)))
    this.#speed = Math.max(0.1, Math.min(10, cfg.get('speed', 1)))

  this.#timer = null
  this.#setupEditors()
  if (this.#enabled) this.start()
  // Listen for editor/range changes to reset flakes
  vscode.window.onDidChangeActiveTextEditor(() => this.#setupEditors())
  vscode.window.onDidChangeTextEditorVisibleRanges(() => this.#setupEditors())
  }

  start() {
    this.#enabled = true
    console.log('SnowDecoration start with', this.#color, this.#size, this.#speed, this.#density)
    if (this.#timer) return
    const fps = 30
    const dt = 1 / fps
    this.#timer = setInterval(() => {
      console.log('SnowDecoration tick')
      this.#tick(dt)
    }, Math.floor(1000 / fps))
  }

  stop() {
    this.#enabled = false
    if (this.#timer) {
      clearInterval(this.#timer)
      this.#timer = null
    }
    for (const { decType } of this.#editors.values()) decType.dispose()
    this.#editors.clear()
  }

  #tick(dt = 1 / 30) {
    if (!this.#enabled) return
    vscode.window.visibleTextEditors.forEach(editor => {
      const key = editor.document.uri.toString()
      const model = this.#editors.get(key)
      if (!model) return
      const vis = editor.visibleRanges[0]
      if (!vis) return
      const top = vis.start.line
      const bottom = vis.end.line
      // Estimate max columns by sampling a few visible lines
      let maxCols = 0
      const linesVisible = Math.max(1, bottom - top)
      const sample = Math.min(8, linesVisible)
      for (let i = 0; i < sample; i++) {
        const line = Math.min(editor.document.lineCount - 1, top + Math.floor((i * linesVisible) / Math.max(1, sample)))
        maxCols = Math.max(maxCols, editor.document.lineAt(line).text.length)
      }
      model.maxColumns = Math.max(120, maxCols + 40)
      // Move flakes: update position, animate size, and recycle if out of view
      const baseSpeed = this.#speed
      for (let j = 0; j < model.flakes.length; j++) {
        const flake = model.flakes[j]
        // Move flake down by its speed factor
        const dy = baseSpeed * (flake.v !== undefined ? flake.v : 1) * dt
        flake.y += dy
        // Animate flake size with a gentle oscillation
        if (flake.sizePhase === undefined || flake.sizePhase === null)
          flake.sizePhase = Math.random() * Math.PI * 2
        if (flake.sizeSpeed === undefined || flake.sizeSpeed === null)
          flake.sizeSpeed = 0.5 + Math.random() * 1.5
        if (flake.sizeAmp === undefined || flake.sizeAmp === null)
          flake.sizeAmp = 0.25 + Math.random() * 0.35
        if (flake.baseSize === undefined || flake.baseSize === null)
          flake.baseSize = this.#size * (0.75 + Math.random() * 0.75)
        // Advance oscillation phase and compute new size
        flake.sizePhase += flake.sizeSpeed * dt
        const factor = 1 + flake.sizeAmp * Math.sin(flake.sizePhase)
        const minS = flake.baseSize * 0.6
        const maxS = flake.baseSize * 1.6
        const s = flake.baseSize * factor
        flake.size = Math.max(minS, Math.min(maxS, s))
        // If flake is below the visible area, recycle it to the top
        if (flake.y > bottom + 2) {
          flake.y = top - Math.random() * 3
          flake.x = Math.random() * model.maxColumns
          // Reset base visuals for recycled flake
          flake.baseSize = this.#size * (0.75 + Math.random() * 0.75)
          flake.sizePhase = Math.random() * Math.PI * 2
          flake.sizeSpeed = 0.5 + Math.random() * 1.5
          flake.sizeAmp = 0.25 + Math.random() * 0.35
          flake.opacity = 0.6 + Math.random() * 0.4
          flake.v = 0.7 + Math.random() * 0.75
        }
      }
      // Ensure flake count matches density
      this.#ensureFlakeCount(editor, model, linesVisible)
      this.#renderEditor(editor, model)
    })
  }

  #setupEditors() {
    // Dispose old decorations
    for (const { decType } of this.#editors.values()) decType.dispose()
    this.#editors.clear()
    vscode.window.visibleTextEditors.forEach(editor => {
      const decType = vscode.window.createTextEditorDecorationType({
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        before: {
          contentText: '❄',
          color: this.#color,
          fontWeight: 'normal'
        }
      })
      const key = editor.document.uri.toString()
      const model = { decType, flakes: [], maxColumns: 120 }
      this.#editors.set(key, model)
      // Spawn flakes for this editor
      const vis = editor.visibleRanges[0]
      const top = vis && vis.start ? vis.start.line : 0
      const bottom = vis && vis.end ? vis.end.line : Math.min(editor.document.lineCount - 1, 40)
      const linesVisible = Math.max(1, bottom - top)
      this.#ensureFlakeCount(editor, model, linesVisible)
      this.#renderEditor(editor, model)
    })
  }
  // Ensure the number of flakes matches density and visible area
  #ensureFlakeCount(editor, model, linesVisible) {
    const target = this.#density
    const cur = model.flakes.length
    const vis = editor.visibleRanges[0]
    const top = vis && vis.start ? vis.start.line : 0
    const bottom = vis && vis.end ? vis.end.line : Math.min(editor.document.lineCount - 1, 40)
    if (cur < target) {
      for (let i = cur; i < target; i++) {
        model.flakes.push({
          x: Math.random() * model.maxColumns,
          y: top + Math.random() * Math.max(1, bottom - top),
          baseSize: this.#size * (0.75 + Math.random() * 0.75),
          sizePhase: Math.random() * Math.PI * 2,
          sizeSpeed: 0.5 + Math.random() * 1.5,
          sizeAmp: 0.25 + Math.random() * 0.35,
          size: this.#size * (0.75 + Math.random() * 0.75),
          opacity: 0.6 + Math.random() * 0.4,
          v: 0.7 + Math.random() * 0.75
        })
      }
    } else if (cur > target) model.flakes.splice(target)
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
