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
      type: 'CONFIG',
      typingDriven: cfg1.get('typingDriven'),
      density: cfg2.get('density'),
      color: this.#hexToRgba('#bcdfff'),
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

  // Convert hex color to rgba string
  #hexToRgba(hex, alpha = 1) {
    let c = hex.replace('#', '')
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
    if (c.length !== 6) return `rgba(180,220,255,${alpha})`
    const r = parseInt(c.substring(0, 2), 16)
    const g = parseInt(c.substring(2, 4), 16)
    const b = parseInt(c.substring(4, 6), 16)
    return `rgba(${r},${g},${b},`
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
