const { workspace: { getConfiguration, onDidChangeConfiguration, onDidChangeTextDocument } } = require('vscode')
const SnowDecoration = require('./SnowDecoration')
const WebviewProvider = require('./WebviewProvider')

class SnowEngine {
  static #snowDecoration
  static #typingDriven
  static #webviewProvider

  static init(context) {
    this.#snowDecoration = new SnowDecoration(context)
    this.#typingDriven = getConfiguration('akazas-love').get('typingDriven')
    this.#webviewProvider = new WebviewProvider(context)
    this.#setupListeners(context)
  }

  static #setupListeners(context) {
    const d1 = onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.snowInEditor')) return
      const sie = getConfiguration('akazas-love').get('snowInEditor')
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
      this.#webviewProvider?.postMessage({ type: 'config', typingDriven: this.#typingDriven })
    })

    const d4 = onDidChangeTextDocument(() => {
      if (!this.#typingDriven) return
      this.#snowDecoration.addFlake()
    })
    context.subscriptions.concat([d1, d2, d3, d4])
  }

  // dispose() {
  //   this.snowDecoration.dispose()
  //   this.snowWebview.dispose()
  // }
}

module.exports = SnowEngine
