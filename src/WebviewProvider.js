const vscode = require('vscode')
const path = require('path')

class HappyImageViewProvider {
  #getHtmlFromFile(imgSrc) {
    const fs = require('fs')
    const htmlPath = path.join(this.context.extensionPath, 'webview', 'index.html')
    let html = fs.readFileSync(htmlPath, 'utf8')
    html = html.replace('{{IMG_SRC}}', imgSrc)
    return html
  }

  /** @param {vscode.ExtensionContext} context */
  constructor(context) {
    this.context = context
  }

  /** @param {vscode.WebviewView} webviewView */
  resolveWebviewView(webviewView) {
    webviewView.webview.options = {
      enableScripts: true
    }
    const imgPath = webviewView.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'happy.png'))
    )
    webviewView.webview.html = this.#getHtmlFromFile(imgPath)

    // Listen for config changes and typing events from extension
    this._webview = webviewView.webview
  }

  /**
   * Send a message to the webview (from extension)
   * @param {object} msg
   */
  postMessage(msg) {
    if (!this._webview) return
    this._webview.postMessage(msg)
  }

}

module.exports = HappyImageViewProvider
