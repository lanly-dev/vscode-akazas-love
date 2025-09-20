const path = require('path')
const vscode = require('vscode')
const MusicSynth = require('./MusicSynth')
const MusicTyping = require('./MusicTyping')
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "akazas-love" is now active!')

  const midiPath = path.join(context.extensionPath, 'media', 'akaza\'s-love-theme.mid')
  const disposable = vscode.commands.registerCommand('akazas-love.playSong', function () {
    // The code you place here will be executed every time your command is executed

    MusicSynth.playMidiFile(midiPath)
  })

  const mt =new MusicTyping(context, midiPath)
  context.subscriptions.push(disposable)
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
  activate,
  deactivate
}
