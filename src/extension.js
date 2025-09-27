const path = require('path')
const vscode = require('vscode')

const MusicSynth = require('./MusicSynth')
const MusicTyping = require('./MusicTyping')
const SnowEngine = require('./SnowEngine')
const Snowfall = require('./SnowDecoration')
const Speaker = require('./Speaker')
const WebviewProvider = require('./WebviewProvider')

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
  console.log('Congratulations, your extension "akazas-love" is now active!')
  // Start Speaker setup in background (non-blocking)
  Speaker.setupSpeaker(context).then(() => {
    vscode.window.setStatusBarMessage('🔊 play-buffer ready', 2000)
  }).catch(() => {
    vscode.window.setStatusBarMessage('⚠️ play-buffer setup failed', 3000)
  })

  const rc = vscode.commands.registerCommand
  const midiPath = path.join(context.extensionPath, 'media', `akaza's-love-theme.mid`)
  const d1 = rc('akazas-love.playSong', () => MusicSynth.playMidiFile(midiPath))

  // Initialize MusicTyping immediately (no await)
  new MusicTyping(context, midiPath)
  const snowfall = new Snowfall(context)
  const d2 = rc('akazas-love.toggleSnowfall', () => snowfall.toggle())
  const happyProvider = new WebviewProvider(context)
  const d3 = vscode.window.registerWebviewViewProvider('akazas-love.webview', happyProvider)
  SnowEngine.init(context)
  context.subscriptions.push(d1, d2, d3, { dispose: () => snowfall.dispose() })
}

// This method is called when your extension is deactivated
function deactivate() {
  try { Speaker.stopPersistentProcesses() } catch { }
}

module.exports = { activate, deactivate }
