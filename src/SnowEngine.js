const vscode = require('vscode')
const SnowDecoration = require('./SnowDecoration')
const SnowTyping = require('./SnowTyping')

class SnowEngine {
  static #snowDecoration
  static #snowTyping
  static #typingDriven

  static init(context) {
    this.#snowDecoration = new SnowDecoration(context)
    this.#snowTyping = new SnowTyping(this.#snowDecoration)
    this.#typingDriven = vscode.workspace.getConfiguration('akazas-love.typingDriven')

    context.subscriptions.concat(this.#setupListeners(context))
  }

  static #setupListeners(context) {
    const d1 = vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.snowConfigs')) return
      const cfg = vscode.workspace.getConfiguration('akazas-love')
      const typingDriven = cfg.get('akazas-love.typingDriven', false)
      console.log('SnowManager config changed:', typingDriven, cfg)
      // this.updateConfig(cfg)
    })

    const d2 = vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.snowInEditor')) return
      const sie = vscode.workspace.getConfiguration('akazas-love.snowInEditor')
      sie ? this.#snowDecoration.start() : this.#snowDecoration.stop()
    })

    const d3 = vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.typingDriven')) return
      this.#typingDriven = vscode.workspace.getConfiguration('akazas-love.typingDriven')
      this.#updateMode(this.#typingDriven ? 'TYPING' : 'FALLING')
    })

    const d4 = vscode.workspace.onDidChangeTextDocument(e => {
      if (!this.#typingDriven) return
      // setSpeed/keypress
    })
    context.subscriptions.concat([d1, d2, d3, d4])
  }

  static #updateMode(mode) {
    this.#snowDecoration.updateMode(mode)
    this.#snowTyping.updateMode(mode)
  }

  // updateConfig(config) {
  //   this.snowDecoration.updateConfig(config)
  //   this.snowTyping.updateConfig(config)
  // }

  // dispose() {
  //   this.snowDecoration.dispose()
  //   this.snowTyping.dispose()
  // }
}

module.exports = SnowEngine
