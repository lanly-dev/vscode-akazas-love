const vscode = require('vscode')
const path = require('path')

class WebviewProvider {

  #context
  #webview

  /** @param {vscode.ExtensionContext} context */
  constructor(context) {
    this.#context = context
  }

  /** @param {vscode.WebviewView} webviewView */
  resolveWebviewView(webviewView) {
    webviewView.webview.options = { enableScripts: true }
    const imgPath = webviewView.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.#context.extensionPath, 'media', 'happy.png'))
    )
    webviewView.webview.html = this.#getHtmlFromFile(imgPath)

    // Listen for config changes and typing events from extension
    this.#webview = webviewView.webview

    // Inject initial params
    const cfg1 = vscode.workspace.getConfiguration('akazas-love')
    const cfg2 = vscode.workspace.getConfiguration('akazas-love.snowConfigs')
    const initParams = {
      type: 'config',
      typingDriven: cfg1.get('typingDriven'),
      speedSensitivity: 0,
      density: cfg2.get('density'),
      color: '#bcdfff',
      speed: cfg2.get('speed')
    }
    setTimeout(() => this.#postMessage(initParams), 100)
  }

  #getHtmlFromFile(imgSrc) {
    const fs = require('fs')
    const htmlPath = path.join(this.#context.extensionPath, 'webview', 'index.html')
    let html = fs.readFileSync(htmlPath, 'utf8')
    html = html.replace('{{IMG_SRC}}', imgSrc)
    return html
  }

  /**
   * Send a message to the webview (from extension)
   * @param {object} msg
   */
  #postMessage(msg) {
    if (!this.#webview) return
    this.#webview.postMessage(msg)
  }
}

module.exports = WebviewProvider
