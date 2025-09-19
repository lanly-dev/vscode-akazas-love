# VS Code Extension: akazas-love

## Project Overview
This is a VS Code extension built with JavaScript using the standard VS Code Extension API. The extension currently implements a simple "Hello World" command but serves as a foundation for more complex functionality.

## Architecture & Key Files

### Core Extension Structure
- **`extension.js`**: Main entry point with `activate()` and `deactivate()` functions
- **`package.json`**: Extension manifest defining commands, activation events, and metadata

### Command Registration Pattern
Commands are defined in `package.json` under `contributes.commands` and implemented in `extension.js`:
```javascript
// In package.json
"contributes": {
  "commands": [{
    "command": "akazas-love.helloWorld",
    "title": "Hello World"
  }]
}

// In extension.js
const disposable = vscode.commands.registerCommand('akazas-love.helloWorld', function () {
  vscode.window.showInformationMessage('Hello World from akaza&#39;s love!');
});
context.subscriptions.push(disposable);
```

## Development Workflow

### Building & Linting
- **Lint**: `npm run lint` (uses ESLint with custom config in `eslint.config.mjs`)

### Code Standards
- **JavaScript**: ES2022 target with Node16 modules (see `jsconfig.json`)
- **ESLint**: Modern ESM config in `eslint.config.mjs` with globals for Node.js and CommonJS

## Extension Patterns

### Activation
- Currently uses empty `activationEvents: []` (activated on startup)
- Extension logs activation in console: `'Congratulations, your extension "akazas-love" is now active!'`

### Resource Management
- Always push disposables to `context.subscriptions` for proper cleanup
- Use `deactivate()` function for cleanup when extension is disabled

### VS Code API Usage
- Import with `const vscode = require('vscode')`
- Commands: `vscode.commands.registerCommand()`
- UI: `vscode.window.showInformationMessage()`

## Key Dependencies
- **Runtime**: VS Code ^1.104.0
- **Development**: ESLint 9.x
- **Node.js**: 22.x target with ES2022 language features