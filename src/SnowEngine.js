const {
  workspace: { getConfiguration, onDidChangeConfiguration, onDidChangeTextDocument },
  window: { onDidChangeActiveColorTheme, onDidChangeActiveTextEditor, onDidChangeTextEditorVisibleRanges, setStatusBarMessage }
} = require('vscode')
const SnowDecoration = require('./SnowDecoration')

class SnowEngine {
  static #snowDecoration
  static #typingDriven
  static #webviewProvider

  static init(context, webviewProvider) {
    this.#snowDecoration = new SnowDecoration(context)
    // Dispose timer?
    // context.subscriptions.push(this.#snowDecoration)
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
      const message = sie ? '❄️ Snow in editor enabled' : '⛔ Snow in editor disabled'
      setStatusBarMessage(message, 3000)
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

    const d3 = onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('akazas-love.typingDriven')) return
      try {
        this.#typingDriven = getConfiguration('akazas-love').get('typingDriven')
        this.#snowDecoration.loadConfigs()
        this.#webviewProvider.reloadConfigs()
        const message = this.#typingDriven ? '❄️ typing-driven snowfall enabled' : '⛔ typing-driven snowfall disabled'
        setStatusBarMessage(message, 3000)
      } catch (error) {
        console.error('Error updating typingDriven config:', error)
      }
    })

    // Need to note why calling setupEditors but not loadConfigs
    const d4 = onDidChangeActiveTextEditor(() => this.#snowDecoration.setupEditors())
    const d5 = onDidChangeTextEditorVisibleRanges(() => this.#snowDecoration.setupEditors())

    const d6 = onDidChangeTextDocument(() => {
      if (!this.#typingDriven) return
      try {
        this.#snowDecoration.addFlake()
        this.#webviewProvider.keyPress()
      } catch (error) {
        console.error('Error in text document change handler:', error)
      }
    })

    // eslint-disable-next-line no-unused-vars
    const d7 = onDidChangeActiveColorTheme((e) => {
      this.#snowDecoration.loadConfigs()
      this.#webviewProvider.reloadConfigs()
    })
    context.subscriptions.push(d1, d2a, d2b, d3, d4, d5, d6, d7)
  }
}

module.exports = SnowEngine
