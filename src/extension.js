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
  const mtObj = new MusicTyping(context, midiPath)
  SnowEngine.init(context)

  const rc = vscode.commands.registerCommand
  const d1 = rc('akazas-love.playSong', () => MusicSynth.playMidiFile(midiPath))

  const d2 = rc('akazas-love.toggleMusicTyping', () => {
    const mt = vscode.workspace.getConfiguration('akazas-love').get('MusicTyping')
    vscode.workspace.getConfiguration('akazas-love').update('MusicTyping', !mt)
    mtObj.toggleEnabled()
  })
  const d3 = rc('akazas-love.toggleSnowInEditor', () => {
    const sie = vscode.workspace.getConfiguration('akazas-love').get('snowInEditor')
    vscode.workspace.getConfiguration('akazas-love').update('snowInEditor', !sie)
  })
  const d4 = rc('akazas-love.toggleSnowDriven', () => {
    const sd = vscode.workspace.getConfiguration('akazas-love').get('typingDriven')
    vscode.workspace.getConfiguration('akazas-love').update('typingDriven', !sd)
  })

  const webviewProvider = new WebviewProvider(context)
  const d5 = vscode.window.registerWebviewViewProvider('akazas-love.webview', webviewProvider)
  context.subscriptions.push(d1, d2, d3, d4, d5)
}

// This method is called when your extension is deactivated
function deactivate() {
  try { Speaker.stopPersistentProcesses() } catch { }
}

module.exports = { activate, deactivate }
