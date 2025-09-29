const path = require('path')
const vscode = require('vscode')

const MusicSynth = require('./MusicSynth')
const MusicTyping = require('./MusicTyping')
const SnowEngine = require('./SnowEngine')
const Speaker = require('./Speaker')
const WebviewProvider = require('./WebviewProvider')

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

  Speaker.setupSpeaker(context).then(() => {
    vscode.window.setStatusBarMessage('🔊 play-buffer ready', 3000)
  }).catch(() => {
    vscode.window.setStatusBarMessage('⚠️ play-buffer setup failed', 3000)
  })

  const midiPath = path.join(context.extensionPath, 'media', `akaza's-love-theme.mid`)
  new MusicTyping(context, midiPath)

  const webviewProvider = new WebviewProvider(context)
  const d0 = vscode.window.registerWebviewViewProvider('akazas-love.webview', webviewProvider)
  SnowEngine.init(context, webviewProvider)

  const rc = vscode.commands.registerCommand
  const d1 = rc('akazas-love.playSong', () => MusicSynth.playMidiFile(midiPath))

  const d2 = rc('akazas-love.toggleMusicTyping', () => {
    const mt = vscode.workspace.getConfiguration('akazas-love').get('musicTyping')
    vscode.workspace.getConfiguration('akazas-love').update('musicTyping', !mt)
  })
  const d3 = rc('akazas-love.toggleSnowInEditor', () => {
    const sie = vscode.workspace.getConfiguration('akazas-love').get('snowInEditor')
    vscode.workspace.getConfiguration('akazas-love').update('snowInEditor', !sie)
  })
  const d4 = rc('akazas-love.toggleSnowDriven', () => {
    const td = vscode.workspace.getConfiguration('akazas-love').get('typingDriven')
    vscode.workspace.getConfiguration('akazas-love').update('typingDriven', !td)
  })

  context.subscriptions.push(d0, d1, d2, d3, d4)
}

// This method is called when your extension is deactivated
function deactivate() {
  try { Speaker.stopPersistentProcesses() } catch { }
}

module.exports = { activate, deactivate }
