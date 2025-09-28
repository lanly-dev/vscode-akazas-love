const path = require('path')
const vscode = require('vscode')

const MusicSynth = require('./MusicSynth')
const MusicTyping = require('./MusicTyping')
const SnowEngine = require('./SnowEngine')
const SnowDecoration = require('./SnowDecoration')
const Speaker = require('./Speaker')
const WebviewProvider = require('./WebviewProvider')

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

  Speaker.setupSpeaker(context).then(() => {
    vscode.window.setStatusBarMessage('🔊 play-buffer ready', 2000)
  }).catch(() => {
    vscode.window.setStatusBarMessage('⚠️ play-buffer setup failed', 3000)
  })

  const midiPath = path.join(context.extensionPath, 'media', `akaza's-love-theme.mid`)
  new MusicTyping(context, midiPath)
  SnowEngine.init(context)

  const rc = vscode.commands.registerCommand
  const d1 = rc('akazas-love.playSong', () => MusicSynth.playMidiFile(midiPath))

  const snowDecoration = new SnowDecoration(context)
  const d2 = rc('akazas-love.toggleSnowfall', () => {
    vscode.workspace.getConfiguration('akazas-love').update('snowInEditor', !snowDecoration.active)
  })

  const webviewProvider = new WebviewProvider(context)
  const d3 = vscode.window.registerWebviewViewProvider('akazas-love.webview', webviewProvider)
  context.subscriptions.push(d1, d2, d3, { dispose: () => snowDecoration.dispose() })
}

// This method is called when your extension is deactivated
function deactivate() {
  try { Speaker.stopPersistentProcesses() } catch { }
}

module.exports = { activate, deactivate }
