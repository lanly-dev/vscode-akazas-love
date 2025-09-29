const { workspace: { getConfiguration, onDidChangeConfiguration, onDidChangeTextDocument } } = require('vscode')
const SnowDecoration = require('./SnowDecoration')

class SnowEngine {
  static #snowDecoration
  static #typingDriven
  static #webviewProvider

  static init(context, webviewProvider) {
    this.#snowDecoration = new SnowDecoration(context)
    this.#typingDriven = getConfiguration('akazas-love').get('typingDriven')
    this.#webviewProvider = webviewProvider
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
      this.#webviewProvider.reloadConfigs()
    })

    const d3 = onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.typingDriven')) return
      this.#typingDriven = getConfiguration('akazas-love').get('typingDriven')
      this.#snowDecoration.loadConfigs()
      this.#webviewProvider?.postMessage({ type: 'TYPING', typingDriven: this.#typingDriven })
    })

    const d4 = onDidChangeTextDocument(() => {
      try {
        if (!this.#typingDriven) return
        this.#snowDecoration.addFlake()
        this.#webviewProvider.keyPress()
      } catch (error) {
        console.error('Error in text document change handler:', error)
      }
    })
    context.subscriptions.concat([d1, d2, d3, d4])
  }

  // dispose() {
  //   this.snowDecoration.dispose()
  //   this.snowWebview.dispose()
  // }
}

module.exports = SnowEngine
