const path = require('path')
const vscode = require('vscode')
const MusicSynth = require('./MusicSynth')
const MusicTyping = require('./MusicTyping')
const Speaker = require('./Speaker')

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

  const midiPath = path.join(context.extensionPath, 'media', 'akaza\'s-love-theme.mid')
  const rc = vscode.commands.registerCommand
  const d1 = rc('akazas-love.playSong', () => MusicSynth.playMidiFile(midiPath))
  if (!Speaker.binaryReady) await Speaker.downloadPlayBuffer(context)

  new MusicTyping(context, midiPath)
  context.subscriptions.push(d1)
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = { activate, deactivate }
