const vscode = require('vscode')
const MusicalTyping = require('./MusicalTyping')

let musicalTyping

function activate(context) {
  console.log('Akaza\'s Love - Musical Typing extension is now active!')

  // Initialize musical typing
  musicalTyping = new MusicalTyping(context)

  // Register commands
  const toggleCommand = vscode.commands.registerCommand('akazas-love.toggleMusic', () => {
    musicalTyping.toggleEnabled()
  })

  const reloadCommand = vscode.commands.registerCommand('akazas-love.reloadMidi', () => {
    musicalTyping.reloadMidi()
  })

  context.subscriptions.push(toggleCommand, reloadCommand)
}

function deactivate() {
  if (musicalTyping) {
    musicalTyping.dispose()
    musicalTyping = null
  }
  console.log('Akaza\'s Love - Musical Typing extension deactivated')
}

module.exports = {
  activate,
  deactivate
}