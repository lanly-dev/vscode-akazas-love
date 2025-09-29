
# VS Code Extension: akazas-love

## Project Overview
Akazas Love is a playful VS Code extension that transforms typing into music and visual snow. It features:
- Musical typing: plays MIDI notes or musical scales as you type.
- Animated snow: snowflakes fall in the editor and in a webview panel.
- Typing-driven snow: snow speed and spawn rate increase with your typing rate.
- Configurable: all features are controlled by user/workspace settings.
- Built with JavaScript, VS Code Extension API, and Web Audio API (when available).

## Architecture & Key Files


### Core Extension Structure
- **`extension.js`**: Main entry point, registers commands, manages activation, and sets up snow/music features.
- **`package.json`**: Extension manifest, commands, config, activation events.
- **`media/akaza's-love-theme.mid`**: MIDI theme file for musical typing.
- **`src/MusicTyping.js`**: Implements musical typing, MIDI loading, and note playback.
- **`src/SnowDecoration.js`**: Handles snowflake animation in the editor, including typing-driven mode.
- **`src/WebviewProvider.js`**: Manages the snow webview panel, config injection, and message passing.
- **`webview/index.html`**: Renders snow animation, debug console, and listens for config/typing events.


### Musical Typing System
- Plays notes from a MIDI file or fallback scale as you type.
- Supports chords (multiple notes at once) and loops the MIDI sequence.
- Volume and enable/disable are configurable.


### MIDI Integration
- Loads `media/akaza's-love-theme.mid` and plays notes in order.
- Groups notes by time for chords.
- Loops to start when finished.
- Fallback to built-in scales if MIDI fails.


### Musical Scales (Fallback)
If MIDI is unavailable, uses pentatonic, major, minor, or chromatic scales for pleasant sound.


## Snow Animation System
- Snowflakes fall in the editor and/or a webview panel.
- Typing-driven mode: snow speed and spawn rate increase with typing rate.
- In typing-driven mode, flakes are not recycled but removed when out of view.
- All snow parameters (density, color, speed, size) are configurable.
- Webview panel includes a debug console for live log output.


## Development Workflow
- **Lint**: `npm run efix` (ESLint with auto-fix)
- **Test Extension**: F5 in VS Code to launch Extension Development Host
- **JavaScript**: ES2022 target with Node16 modules
- **ESLint**: Custom rules including `curly: ['error', 'multi-or-nest']`

## Extension Patterns
- Event-driven: listens for document changes, config changes, and user commands.
- Webview: receives config and typing events, displays snow and debug console.
- All config is live and can be changed at runtime.

## Configuration System
User settings in `contributes.configuration`:
- `akazas-love.musicTyping`: Enable/disable musical typing
- `akazas-love.volume`: Number (0.0-1.0)
- `akazas-love.snowInEditor`: Enable/disable snow in editor
- `akazas-love.typingDriven`: Enable/disable typing-driven snow
- `akazas-love.snowConfigs`: Object for snow params (density, color, speed, size, maxColumns)

## Commands
- `akazas-love.toggleMusic`: Enable/disable musical typing
- `akazas-love.reloadMidi`: Reload MIDI theme file
- `akazas-love.toggleSnow`: Enable/disable snow

## Activation & Performance
- Immediate activation on startup
- MIDI and snow config loaded on startup and on config change
- Keystroke filtering: only single characters, excludes newlines and large pastes
- Resource management: cleans up listeners and intervals on deactivate

## Audio/Visual Fallback
- If Web Audio API is unavailable, shows musical symbols in status bar
- Snow always animates visually, even if music is disabled

## Webview Debug Console
- A debug console section in the webview displays recent console.log output for live debugging

## Key Dependencies
- **VS Code**: ^1.104.0
- **@tonejs/midi**: MIDI parsing
- **ESLint**: 9.x
- **Node.js**: 22.x