const { workspace: { getConfiguration, onDidChangeConfiguration, onDidChangeTextDocument } } = require('vscode')
const SnowDecoration = require('./SnowDecoration')
const SnowTyping = require('./SnowTyping')

class SnowEngine {
  static #snowDecoration
  static #snowTyping
  static #typingDriven

  static init(context) {
    this.#snowDecoration = new SnowDecoration(context)
    this.#snowTyping = new SnowTyping(this.#snowDecoration)
    this.#typingDriven = getConfiguration('akazas-love').get('typingDriven')
    this.#setupListeners(context)
  }

  static #setupListeners(context) {
    const d1 = onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.snowInEditor')) return
      const sie = getConfiguration('akazas-love').get('snowInEditor')
      sie ? this.#snowDecoration.start() : this.#snowDecoration.stop()
    })

    const d2 = onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.snowConfigs')) return
      const cfg = getConfiguration('akazas-love').get('snowConfigs')
      console.log('SnowManager config changed:', cfg)
      // this.updateConfig(cfg)
    })

    const d3 = onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.typingDriven')) return
      this.#typingDriven = getConfiguration('akazas-love').get('typingDriven')
      this.#updateMode(this.#typingDriven ? 'TYPING' : 'FALLING')
    })

    const d4 = onDidChangeTextDocument(e => {
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
