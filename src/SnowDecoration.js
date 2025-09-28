const vscode = require('vscode')

class SnowDecoration {

  #FPS = 15

  #editors
  #enabled
  #typingDriven

  #color
  #density
  #maxColumns
  #size
  #speed

  #stopping
  #timer

  constructor() {

    this.loadConfigs()
    this.#editors = new Map() // key: editor id -> { flakes: [], decType, maxColumns }
    this.#stopping = false
    this.#timer = null
    if (this.#enabled) this.start()

    // Move to SnowEngine.js
    // Listen for editor/range changes to reset flakes
    vscode.window.onDidChangeActiveTextEditor(() => this.#setupEditors())
    vscode.window.onDidChangeTextEditorVisibleRanges(() => this.#setupEditors())
  }

  loadConfigs() {
    const cfg = vscode.workspace.getConfiguration('akazas-love.snowConfigs')
    this.#enabled = vscode.workspace.getConfiguration('akazas-love').get('snowInEditor')
    this.#typingDriven = vscode.workspace.getConfiguration('akazas-love').get('typingDriven')

    this.#color = cfg.get('color')
    this.#density = cfg.get('density')
    this.#size = cfg.get('size')
    this.#speed = cfg.get('speed')
    this.#maxColumns = cfg.get('maxColumns')
  }

  start() {
    console.log('SnowDecoration start')
    if (this.#timer) {
      // console.trace('SnowDecoration already started')
      return
    }
    this.#setupEditors()
    const dt = 1 / this.#FPS
    this.#timer = setInterval(() => { this.#tick(dt) }, Math.floor(1000 / this.#FPS))
  }

  stop() {
    console.log('SnowDecoration stop')
    this.#stopping = true
  }

  /**
   * Advance the snowflake animation for all visible editors.
   * Moves, animates, and recycles flakes, then triggers rendering.
   * @param {number} dt - Time step in seconds (e.g. 1/30 for 30 FPS).
   */
  #tick(dt) {
    console.log('SnowDecoration #tick')
    vscode.window.visibleTextEditors.forEach(editor => {
      if (editor.document.uri.scheme !== 'file') return
      const key = editor.document.uri.toString()
      const model = this.#editors.get(key)

      if (!model) return

      const vis = editor.visibleRanges[0]
      if (!vis) return
      const top = vis.start.line
      const bottom = vis.end.line

      model.maxColumns = this.#maxColumns

      // Move flakes: update position, animate size, and recycle if out of view
      const baseSpeed = this.#speed
      for (let j = 0; j < model.flakes.length; j++) {
        const flake = model.flakes[j]
        // Move flake down by its speed factor
        const dy = baseSpeed * (flake.v !== undefined ? flake.v : 1) * dt
        flake.y += dy

        // Animate flake size with a gentle oscillation
        flake.sizePhase ??= Math.random() * Math.PI * 2
        flake.sizeSpeed ??= 0.5 + Math.random() * 1.5
        flake.sizeAmp ??= 0.25 + Math.random() * 0.35
        flake.baseSize ??= this.#size * (0.75 + Math.random() * 0.75)

        // Advance oscillation phase and compute new size
        flake.sizePhase += flake.sizeSpeed * dt
        const factor = 1 + flake.sizeAmp * Math.sin(flake.sizePhase)
        const minS = flake.baseSize * 0.6
        const maxS = flake.baseSize * 1.6
        const s = flake.baseSize * factor
        flake.size = Math.max(minS, Math.min(maxS, s))

        // If flake is below the visible area, recycle it to the top unless stopping
        if (flake.y > bottom + 2 && !this.#stopping && !this.#typingDriven) {
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
      if (this.#stopping) {
        // If stopping and all flakes are out of view, clear decorations
        const allOutOfView = model.flakes.every(flake => flake.y > bottom + 2)
        if (allOutOfView) {
          if (this.#timer) {
            clearInterval(this.#timer)
            this.#timer = null
          }
          for (const { decType } of this.#editors.values()) decType.dispose()
          this.#editors.clear()
          this.#stopping = false
          return
        }
      }
      if (!this.#typingDriven) this.#ensureFlakeCount(editor, model)
      this.#renderEditor(editor, model)
    })
  }

  /**
   * Set up snowflake models and decorations for all visible editors.
   * Disposes old decorations, creates new ones, and spawns flakes for each editor.
   * Called on activation and whenever visible editors or ranges change.
   * @private
   */
  #setupEditors() {
    if (!this.#enabled) return

    // Dispose old decorations
    for (const { decType } of this.#editors.values()) decType.dispose()
    this.#editors.clear()

    vscode.window.visibleTextEditors.forEach(editor => {
      if (editor.document.uri.scheme !== 'file') return
      const decType = vscode.window.createTextEditorDecorationType({
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        before: {
          contentText: '❄',
          color: this.#color,
          fontWeight: 'normal'
        }
      })
      const key = editor.document.uri.toString()
      const model = { decType, flakes: [], maxColumns: this.#maxColumns }
      this.#editors.set(key, model)
      // Spawn flakes for this editor
      const vis = editor.visibleRanges[0]
      const top = vis && vis.start ? vis.start.line : 0
      const bottom = vis && vis.end ? vis.end.line : Math.min(editor.document.lineCount - 1, 40)
      const linesVisible = Math.max(1, bottom - top)
      if (!this.#typingDriven) this.#ensureFlakeCount(editor, model, linesVisible)
      this.#renderEditor(editor, model)
    })
  }

  /**
   * Ensure the number of snowflakes in the model matches the configured density.
   * Adds or removes flakes as needed, and spawns new flakes within the visible area.
   * @param {vscode.TextEditor} editor - The editor for which to manage flakes.
   * @param {Object} model - The snow model for this editor (contains flakes, decType, maxColumns).
   */
  #ensureFlakeCount(editor, model) {
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

  addFlake() {
    if (!this.#enabled) return
    vscode.window.visibleTextEditors.forEach(editor => {
      if (editor.document.uri.scheme !== 'file') return
      const model = this.#editors.get(editor.document.uri.toString())
      if (!model) return
      const vis = editor.visibleRanges[0]
      const top = vis && vis.start ? vis.start.line : 0
      model.flakes.push({
        x: Math.random() * model.maxColumns,
        y: top,
        baseSize: this.#size * (0.75 + Math.random() * 0.75),
        sizePhase: Math.random() * Math.PI * 2,
        sizeSpeed: 0.5 + Math.random() * 1.5,
        sizeAmp: 0.25 + Math.random() * 0.35,
        size: this.#size * (0.75 + Math.random() * 0.75),
        opacity: 0.6 + Math.random() * 0.4,
        v: 0.7 + Math.random() * 0.75
      })
    })
  }

  /**
   * Render all snowflakes for a given editor using VS Code decorations.
   * @param {vscode.TextEditor} editor - The editor to render snowflakes in.
   * @param {Object} model - The snow model for this editor (contains flakes, decType, maxColumns).
   */
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
