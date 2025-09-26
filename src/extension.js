const path = require('path')
const vscode = require('vscode')
const MusicSynth = require('./MusicSynth')
const MusicTyping = require('./MusicTyping')
const Speaker = require('./Speaker')
const Snowfall = require('./Snowfall')
const HappyImageViewProvider = require('./WebviewProvider')

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

  const midiPath = path.join(context.extensionPath, 'media', 'akaza\'s-love-theme.mid')
  const rc = vscode.commands.registerCommand
  const d1 = rc('akazas-love.playSong', () => MusicSynth.playMidiFile(midiPath))
  if (!Speaker.binaryReady) await Speaker.downloadPlayBuffer(context)
  Speaker.startPersistentProcess()

  new MusicTyping(context, midiPath)
  const snowfall = new Snowfall(context)
  const d2 = rc('akazas-love.toggleSnowfall', () => snowfall.toggle())
  const happyProvider = new HappyImageViewProvider(context)
  const d3 = vscode.window.registerWebviewViewProvider('akazas-love.happyImageView', happyProvider)
  context.subscriptions.push(d1, d2, d3, { dispose: () => snowfall.dispose() })

  // --- Typing-driven snow integration for webview ---
  let typingDriven = false
  let speedSensitivity = 3
  let density = 80
  let lastKeyTime = 0
  let typingRate = 0
  function sendConfigToWebview() {
    if (!happyProvider.postMessage) return
    const cfg = vscode.workspace.getConfiguration('akazas-love')
    typingDriven = cfg.get('snowfall.typingDriven', false)
    speedSensitivity = cfg.get('snowfall.speedSensitivity', 3)
    density = cfg.get('snowfall.density', 80)
    happyProvider.postMessage({
      type: 'config',
      typingDriven,
      speedSensitivity,
      density
    })
  }
  // Listen for config changes
  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('akazas-love.snowfall')) sendConfigToWebview()
  })
  // Listen for typing events
  vscode.workspace.onDidChangeTextDocument(event => {
    if (!typingDriven) return
    if (!event.contentChanges.length) return
    const change = event.contentChanges[0]
    if (change.text.length !== 1 || change.text === '\n' || change.text === '\r\n') return
    const now = Date.now()
    if (lastKeyTime) {
      const dt = (now - lastKeyTime) / 1000
      typingRate = dt > 0 ? 1 / dt : 0
    }
    lastKeyTime = now
    if (happyProvider.postMessage)
      happyProvider.postMessage({ type: 'key', typingRate })
  })
  // Initial config
  setTimeout(sendConfigToWebview, 1000)
}

// This method is called when your extension is deactivated
function deactivate() {
  try { Speaker.stopPersistentProcess() } catch {}
}

module.exports = { activate, deactivate }
