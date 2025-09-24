const path = require('path')
const vscode = require('vscode')
const MusicSynth = require('./MusicSynth')
const MusicTyping = require('./MusicTyping')
const Speaker = require('./Speaker')
const Snowfall = require('./Snowfall')

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

  const midiPath = path.join(context.extensionPath, 'media', 'akaza\'s-love-theme.mid')
  const rc = vscode.commands.registerCommand
  const d1 = rc('akazas-love.playSong', () => MusicSynth.playMidiFile(midiPath))
  if (!Speaker.binaryReady) await Speaker.downloadPlayBuffer(context)
  // Start persistent speaker process (Windows)
  Speaker.startPersistentProcess()

  new MusicTyping(context, midiPath)
  const snowfall = new Snowfall(context)
  const d2 = rc('akazas-love.toggleSnowfall', () => snowfall.toggle())
  context.subscriptions.push(d1, d2, { dispose: () => snowfall.dispose() })
}

// This method is called when your extension is deactivated
function deactivate() {
  try { Speaker.stopPersistentProcess() } catch {}
}

module.exports = { activate, deactivate }
