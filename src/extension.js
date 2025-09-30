const vscode = require('vscode')

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

  MusicTyping.init(context)
  const webviewProvider = new WebviewProvider(context)
  SnowEngine.init(context, webviewProvider)
  const rc = vscode.commands.registerCommand

  const d0 = vscode.window.registerWebviewViewProvider('akazas-love.webview', webviewProvider)

  const d1a = rc('akazas-love.playSong', () => MusicTyping.playMidiFile(true))
  const d1b = rc('akazas-love.stopSong', () => MusicTyping.playMidiFile(false))

  const d2 = rc('akazas-love.toggleMusicTyping', () => {
    const mt = vscode.workspace.getConfiguration('akazas-love').get('musicTyping')
    vscode.workspace.getConfiguration('akazas-love').update('musicTyping', !mt)
  })

  const d3 = rc('akazas-love.toggleSnowInEditor', toggleShowInEditor)
  const d3a = rc('akazas-love.toggleSnowInEditorOn', toggleShowInEditor)
  const d3b = rc('akazas-love.toggleSnowInEditorOff', toggleShowInEditor)

  const d4 = rc('akazas-love.toggleSnowDriven', () => {
    const td = vscode.workspace.getConfiguration('akazas-love').get('typingDriven')
    vscode.workspace.getConfiguration('akazas-love').update('typingDriven', !td)
  })

  const d5 = rc('akazas-love.showPanel', () => {
    vscode.commands.executeCommand('akazas-love.webview.focus')
  })

  const d6 = rc('akazas-love.openSettings', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', '@ext:lanly-dev.akazas-love')
  })
  context.subscriptions.push(d0, d1a, d1b, d2, d3, d3a, d3b, d4, d5, d6)
}

function toggleShowInEditor() {
  const sie = vscode.workspace.getConfiguration('akazas-love').get('snowInEditor')
  vscode.workspace.getConfiguration('akazas-love').update('snowInEditor', !sie)
}

// This method is called when your extension is deactivated
function deactivate() {
  try {
    Speaker.stopAllProcesses()
  } catch (e) {
    vscode.window.showErrorMessage('Error stopping Speaker processes: ' + e.message)
  }
}

module.exports = { activate, deactivate }
