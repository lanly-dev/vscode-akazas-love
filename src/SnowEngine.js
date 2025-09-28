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
      console.log('SnowManager snowInEditor changed:', sie)
      this.#snowDecoration.loadConfigs()
      sie ? this.#snowDecoration.start() : this.#snowDecoration.stop()
    })

    const d2 = onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.snowConfigs')) return
      this.#snowDecoration.loadConfigs()
    })

    const d3 = onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.typingDriven')) return
      this.#typingDriven = getConfiguration('akazas-love').get('typingDriven')
      this.#snowDecoration.loadConfigs()
    })

    const d4 = onDidChangeTextDocument(() => {
      if (!this.#typingDriven) return
      console.log('SnowEngine: typing detected, adding flake')
      this.#snowDecoration.addFlake()
    })
    context.subscriptions.concat([d1, d2, d3, d4])
  }

  // dispose() {
  //   this.snowDecoration.dispose()
  //   this.snowTyping.dispose()
  // }
}

module.exports = SnowEngine
