
const vscode = require('vscode')
const snowTyping = require('./SnowTyping')

class Snowfall {

  #snowTyping
  #speedSensitivity
  #typingDriven

  /** @param {vscode.ExtensionContext} context */
  constructor(context) {
    this.context = context
    this.timer = null
    this.editors = new Map() // key: editor id -> { flakes: [], decType, maxColumns }

    this.#snowTyping = new snowTyping(this)

    this.disposables = []
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.#resetEditors()),
      vscode.window.onDidChangeTextEditorVisibleRanges(() => this.#refreshFlakesLayout()),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('akazas-love.snowfall')) this.#loadConfig()
      })
    )

    // Load config and start if enabled
    this.#loadConfig()
    if (this.enabled) this.start()
  }

  #loadConfig() {
    const cfg = vscode.workspace.getConfiguration('akazas-love')
    const prevEnabled = this.enabled
    const prevTypingDriven = this.#typingDriven

    this.color = cfg.get('snowfall.color')
    this.density = Math.max(0, Math.min(500, cfg.get('snowfall.density')))
    this.enabled = cfg.get('snowfall.enabled')
    this.size = Math.max(6, Math.min(50, cfg.get('snowfall.size')))
    this.speed = Math.max(1, Math.min(60, cfg.get('snowfall.speed')))

    this.#typingDriven = cfg.get('snowfall.typingDriven', false)
    this.#speedSensitivity = Math.max(1, Math.min(10, cfg.get('snowfall.speedSensitivity')))
    this.#snowTyping.loadConfig(cfg)
    if (prevEnabled !== this.enabled || prevTypingDriven !== this.#typingDriven) {
      if (this.enabled) this.start()
      else this.stop()
    }
  }

  start() {
    if (this.timer || !this.enabled) return
    this.enabled = true
    this.#resetEditors()
    if (this.#typingDriven) this.#snowTyping.start()
    else this.#startNormalSnow()
  }

  #startNormalSnow() {
    if (this.timer) return
    const fps = 30
    const dt = 1 / fps
    this.timer = setInterval(() => this.#tick(dt), Math.floor(1000 / fps))
    this.#snowTyping.stop()
  }



  // Expose for snowTyping
  editorKey(editor) {
    return this.#editorKey(editor)
  }

  renderEditor(editor, model) {
    return this.#renderEditor(editor, model)
  }

  stop() {
    this.enabled = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.#snowTyping.stop()
    for (const { decType } of this.editors.values()) {
      const editor = this.#findEditorByDecType(decType)
      if (editor) editor.setDecorations(decType, [])
      decType.dispose()
    }
    this.editors.clear()
  }

  toggle() {
    if (this.enabled) this.stop()
    else this.start()
    let msg = '❄ Snowfall '
    if (this.enabled)  msg += this.#typingDriven ? 'per keypress (typing-driven)' : 'on empty lines'
    else msg += 'stopped'
    vscode.window.setStatusBarMessage(msg, 1500)
  }

  #renderEditor(editor, model) {
    // Render all flakes in model.flakes
    const vis = editor.visibleRanges[0]
    if (!vis) return
    // const top = vis.start.line // unused
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
      const scale = Math.max(0.3, flake.size / this.size)
      opts.push({
        range,
        renderOptions: {
          before: {
            contentText: '❄',
            color: this.#rgba(this.color, flake.opacity),
            textDecoration: `none; position: absolute; left: 0; transform: translateX(${col}ch) scale(${scale.toFixed(3)}); transform-origin: top left; pointer-events: none;`
          }
        }
      })
    }
    editor.setDecorations(model.decType, opts)
  }

  dispose() {
    this.stop()
    this.disposables.forEach(d => { try { d.dispose() } catch { } })
    this.disposables = []
  }

  #resetEditors() {
    for (const { decType } of this.editors.values()) decType.dispose()
    this.editors.clear()
    vscode.window.visibleTextEditors.forEach(editor => {
      const decType = vscode.window.createTextEditorDecorationType({
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        before: {
          contentText: '❄',
          color: this.color,
          fontWeight: 'normal'
        }
      })
      const key = this.#editorKey(editor)
      const model = { decType, flakes: [], maxColumns: 80 }
      this.editors.set(key, model)
      this.#spawnFlakesForEditor(editor, model)
    })
  }

  #refreshFlakesLayout() {
    vscode.window.visibleTextEditors.forEach(editor => {
      const key = this.#editorKey(editor)
      const model = this.editors.get(key)
      if (!model) return
      const vis = editor.visibleRanges[0]
      const top = vis?.start?.line ?? 0
      const bottom = vis?.end?.line ?? Math.min(editor.document.lineCount - 1, top)
      const linesVisible = Math.max(1, bottom - top)
      this.#ensureFlakeCount(editor, model, linesVisible)
    })
  }

  #spawnFlakesForEditor(editor, model) {
    const vis = editor.visibleRanges[0]
    const top = vis?.start?.line ?? 0
    const bottom = vis?.end?.line ?? Math.min(editor.document.lineCount - 1, top)
    const linesVisible = Math.max(1, bottom - top)
    model.flakes = []
    this.#ensureFlakeCount(editor, model, linesVisible)
  }

  #tick(dt) {
    if (!this.enabled) return
    vscode.window.visibleTextEditors.forEach(editor => {
      const key = this.#editorKey(editor)
      const model = this.editors.get(key)
      if (!model) return
      const vis = editor.visibleRanges[0]
      if (!vis) return
      const top = vis.start.line
      const bottom = vis.end.line
      const linesVisible = Math.max(1, bottom - top) // This line is now removed from the method signature

      // Estimate max columns by sampling a few visible lines
      let maxCols = 0
      const sample = Math.min(8, linesVisible)
      for (let i = 0; i < sample; i++) {
        const line = Math.min(editor.document.lineCount - 1, top + Math.floor((i * linesVisible) / Math.max(1, sample)))
        maxCols = Math.max(maxCols, editor.document.lineAt(line).text.length)
      }
      // Allow a wide horizontal span: at least 120ch, or a bit beyond the longest visible line
      model.maxColumns = Math.max(120, maxCols + 40)

      // Move flakes: update position, animate size, and recycle if out of view
      const baseSpeed = this.speed
      for (const flake of model.flakes) {
        // Move flake down by its speed factor
        const dy = baseSpeed * (flake.v ?? 1) * dt
        flake.y += dy

        // Animate flake size with a gentle oscillation
        if (flake.sizePhase === undefined || flake.sizePhase === null)
          flake.sizePhase = Math.random() * Math.PI * 2
        if (flake.sizeSpeed === undefined || flake.sizeSpeed === null)
          flake.sizeSpeed = 0.5 + Math.random() * 1.5
        if (flake.sizeAmp === undefined || flake.sizeAmp === null)
          flake.sizeAmp = 0.25 + Math.random() * 0.35
        if (flake.baseSize === undefined || flake.baseSize === null)
          flake.baseSize = flake.size || (this.size * (0.75 + Math.random() * 0.75))

        // Advance oscillation phase and compute new size
        flake.sizePhase += flake.sizeSpeed * dt
        const factor = 1 + flake.sizeAmp * Math.sin(flake.sizePhase)
        const minS = flake.baseSize * 0.6
        const maxS = flake.baseSize * 1.6
        const s = flake.baseSize * factor
        flake.size = Math.max(minS, Math.min(maxS, s))

        // If typing-driven, do NOT recycle flakes
        if (!this.#typingDriven) {
          // If flake is below the visible area, recycle it to the top
          if (flake.y > bottom + 2) {
            flake.y = top - Math.random() * 3
            flake.x = Math.random() * model.maxColumns
            // Reset base visuals for recycled flake
            flake.baseSize = this.size * (0.75 + Math.random() * 0.75)
            flake.sizePhase = Math.random() * Math.PI * 2
            flake.sizeSpeed = 0.5 + Math.random() * 1.5
            flake.sizeAmp = 0.25 + Math.random() * 0.35
            flake.size = flake.baseSize
            flake.opacity = 0.6 + Math.random() * 0.4
            flake.v = this.#randSpeedFactor()
          }
        }
      }

      // Render at same column; if current line has text at that column, fall through vertically
      // to the first line below where that column is whitespace (or beyond EOL).
      const opts = []
      for (const flake of model.flakes) {
        const startLine = Math.max(0, Math.min(editor.document.lineCount - 1, Math.floor(flake.y)))
        // Use integer column positioning to avoid sub-ch jitter
        const col = Math.max(0, Math.round(flake.x))
        let renderLine = -1
        for (let l = startLine; l <= bottom; l++) {
          const text = editor.document.lineAt(l).text
          if (this.#isWhitespaceAt(text, col)) { renderLine = l; break }
        }
        if (renderLine === -1) continue // nothing to render in view yet; flake continues falling
        const range = new vscode.Range(renderLine, 0, renderLine, 0)
        const scale = Math.max(0.3, flake.size / this.size)
        opts.push({
          range,
          renderOptions: {
            before: {
              contentText: '❄',
              color: this.#rgba(this.color, flake.opacity),
              // Position via transform so glyph scaling doesn't affect horizontal placement
              // Use editor font's ch width (inherit) and scale glyph separately
              textDecoration: `none; position: absolute; left: 0; transform: translateX(${col}ch) scale(${scale.toFixed(3)}); transform-origin: top left; pointer-events: none;`
            }
          }
        })
      }
      editor.setDecorations(model.decType, opts)
      this.#ensureFlakeCount(editor, model) // Updated call to remove linesVisible
    })
  }

  #isWhitespaceAt(text, idx) {
    if (idx >= text.length) return true // beyond EOL counts as empty space
    const ch = text[idx]
    return /\s/.test(ch)
  }

  #ensureFlakeCount(editor, model) {
    const target = this.density
    const cur = model.flakes.length
    if (cur < target) {
      const vis = editor.visibleRanges[0]
      const top = vis?.start?.line ?? 0
      const bottom = vis?.end?.line ?? Math.min(editor.document.lineCount - 1, top)
      for (let i = cur; i < target; i++) {
        model.flakes.push({
          x: Math.random() * model.maxColumns,
          y: top + Math.random() * Math.max(1, bottom - top),
          baseSize: this.size * (0.75 + Math.random() * 0.75),
          sizePhase: Math.random() * Math.PI * 2,
          sizeSpeed: 0.5 + Math.random() * 1.5,
          sizeAmp: 0.25 + Math.random() * 0.35,
          size: this.size * (0.75 + Math.random() * 0.75),
          opacity: 0.6 + Math.random() * 0.4,
          v: this.#randSpeedFactor()
        })
      }
    } else if (cur > target) model.flakes.splice(target)
  }

  #editorKey(editor) { return editor?.document?.uri?.toString() || 'unknown' }

  #findEditorByDecType(decType) {
    for (const editor of vscode.window.visibleTextEditors) {
      const key = this.#editorKey(editor)
      const m = this.editors.get(key)
      if (m && m.decType === decType) return editor
    }
    return null
  }

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

  #randSpeedFactor() {
    // Vary between ~0.6x and ~1.5x base speed for a natural look
    return 0.6 + Math.random() * 0.9
  }
}

module.exports = Snowfall
