const {
  workspace: { getConfiguration, onDidChangeConfiguration, onDidChangeTextDocument },
  window: { onDidChangeActiveColorTheme }
} = require('vscode')
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

    const d2a = onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.snowEditorConfigs')) return
      try {
        this.#snowDecoration.loadConfigs()
      } catch (error) {
        console.error('Error reloading snow editor configs:', error)
      }
    })

    const d2b = onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.snowPanelConfigs')) return
      try {
        this.#webviewProvider.reloadConfigs()
      } catch (error) {
        console.error('Error reloading snow panel configs:', error)
      }
    })

    // eslint-disable-next-line no-unused-vars
    const d2c = onDidChangeActiveColorTheme((e) => {
      this.#snowDecoration.loadConfigs()
      this.#webviewProvider.reloadConfigs()
    })

    const d3 = onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.typingDriven')) return
      try {
        this.#typingDriven = getConfiguration('akazas-love').get('typingDriven')
        this.#snowDecoration.loadConfigs()
        this.#webviewProvider.reloadConfigs()
      } catch (error) {
        console.error('Error updating typingDriven config:', error)
      }
    })

    const d4 = onDidChangeTextDocument(() => {
      if (!this.#typingDriven) return
      try {
        this.#snowDecoration.addFlake()
        this.#webviewProvider.keyPress()
      } catch (error) {
        console.error('Error in text document change handler:', error)
      }
    })
    context.subscriptions.concat([d1, d2a, d2b, d3, d4])
  }
}

module.exports = SnowEngine
