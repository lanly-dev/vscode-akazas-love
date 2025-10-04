
# VS Code Extension: akazas-love

## Project Overview
Akazas Love is a VS Code extension that transforms typing into music and animated snowfall, themed around the Demon Slayer character Akaza. It features real-time MIDI playback, editor decorations, and webview animations that respond to user typing patterns.

## Architecture & Component Overview

### Core Extension Structure
- **`src/extension.js`**: Main activation point - registers 12 commands, initializes all systems, manages disposables
- **`src/MusicTyping.js`**: MIDI parsing (@tonejs/midi), note sequencing, audio synthesis via Speaker class
- **`src/MusicSynth.js`**: PCM audio generation (44.1kHz Float32), chord scaling, envelope processing
- **`src/Speaker.js`**: Native binary integration (play-buffer), multi-stream audio, cross-platform downloads
- **`src/SnowDecoration.js`**: VS Code text decorations for snowflakes, collision detection, animation loops
- **`src/SnowEngine.js`**: Event coordinator between typing, config changes, and snow systems
- **`src/WebviewProvider.js`**: Webview lifecycle, message passing, theme-aware config injection
- **`src/TypingRate.js`**: Keystroke rate calculation (sliding window), drives dynamic snow/music intensity

### Data Flow Architecture
```
User Types → MusicTyping (MIDI notes) + SnowEngine (flake spawn)
           ↓
Config Changes → SnowEngine → SnowDecoration (editor) + WebviewProvider (panel)
           ↓
Speaker.js ← MusicSynth (PCM) ← MusicTyping (frequencies)
```


## Critical Development Patterns

### Build System (esbuild + minify)
- **Build**: `npm run build` (production) / `npm run build-dev` (with sourcemaps)
- **Extension**: esbuild bundles `src/extension.js` → `dist/extension.js` (excludes 'vscode')
- **Webview**: minify processes `src/index.html` → `dist/index.html` (inline CSS/JS compression)
- **Debug**: Press F5 launches Extension Development Host with prelaunch build task

### Memory Management & Disposables
- ALL event listeners MUST be added to `context.subscriptions` (prevents leaks)
- SnowDecoration implements `dispose()` method (clears timers, decorations, listeners)
- Speaker class maintains process pools (100 streams) with proper cleanup in `deactivate()`

### Configuration System Pattern
```javascript
// Live config updates - ALL modules follow this pattern
const config = vscode.workspace.getConfiguration('akazas-love')
const disposable = vscode.workspace.onDidChangeConfiguration(e => {
  if (e.affectsConfiguration('akazas-love.specificSetting')) {
    this.loadConfigs() // Reload and apply immediately
  }
})
context.subscriptions.push(disposable)
```

### Audio Architecture (Cross-Platform)
- Downloads platform-specific `play-buffer` binary from GitHub releases on first run
- MusicSynth generates Float32Array PCM → Speaker converts to Buffer → native binary
- Supports both single playback (MIDI files) and multi-stream (typing notes)
- 44.1kHz sample rate, chord volume scaling (1/chordSize), envelope processing

### Animation System Design
- **Editor Snow**: VS Code decorations with absolute positioning, collision detection
- **Webview Snow**: Canvas-based with requestAnimationFrame, typing rate boost
- **Typing-Driven**: TypingRate class tracks keystrokes/sec, affects speed/spawn rate
- Both systems share configs but use different rendering approaches

## Development Workflow

### Essential Commands
- **Debug**: F5 (launches Extension Development Host)
- **Build**: `npm run build-dev` (development with sourcemaps)
- **Lint**: `npm run efix` (ESLint auto-fix)
- **Package**: `npm run vsce-package` (creates .vsix)

### Testing Strategy
- Use Extension Development Host for manual testing
- Test typing in different file types (scheme !== 'file' filters out non-editor content)
- Verify config changes apply live (no restart required)
- Test cross-platform audio binary downloads

### ESLint Configuration
- Custom rule: `curly: ['error', 'multi-or-nest']` (allows single-line if without braces)
- Node.js environment, ES2022 target
- Enforces single quotes, no trailing commas, semicolon-free style

## Extension-Specific Patterns

### Event Filtering
```javascript
// Only process single character typing, ignore pastes/newlines
if (change.text.length === 1 && (change.text === '\n' || change.text === '\r\n')) return
```

### Theme-Aware Configuration
```javascript
// Separate light/dark theme colors with fallback to defaults
const themeKind = vscode.window.activeColorTheme.kind
const color = themeKind === vscode.ColorThemeKind.Light ? colorLight : colorDark
```

### Webview Message Protocol
```javascript
// Structured message passing with type-based routing
webview.postMessage({ type: 'CONFIG', density, color, typingDriven })
webview.postMessage({ type: 'KEY', typingRate })
```

### Command Registration Pattern
```javascript
// Conditional menu visibility based on config state and context
"when": "view == akazas-love.webview && config.akazas-love.musicTyping == true"
```

## File Structure Notes
- `src/` contains source files, `dist/` contains built extension
- `media/` contains MIDI, images, SVG icons (excluded from .vsixignore)
- `.vscode/` contains debug configuration and extension recommendations
- Build outputs to `dist/` which is the actual extension entry point (`main: "./dist/extension.js"`)
