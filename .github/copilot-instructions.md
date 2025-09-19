# VS Code Extension: akazas-love

## Project Overview
This is a VS Code extension that transforms typing into music by playing musical notes for each keystroke. Built with JavaScript using the VS Code Extension API and Web Audio API for real-time sound generation.

## Architecture & Key Files

### Core Extension Structure
- **`extension.js`**: Main entry point with `activate()`, `deactivate()`, and `MusicalTyping` class
- **`package.json`**: Extension manifest defining commands, configuration settings, and activation events
- **`media/akaza's-love-theme.mid`**: MIDI theme file that plays sequentially during typing

### Musical Typing System
The extension implements a complete musical typing experience:
```javascript
// Main class structure
class MusicalTyping {
  constructor(context) {
    this.audioContext = null // Web Audio API context
    this.enabled = true      // Toggle state
    this.volume = 0.1        // Volume level (0.0-1.0)
    this.scale = 'pentatonic' // Musical scale selection
    this.midiNotes = []      // Loaded MIDI file notes
    this.currentNoteIdx = 0  // Current position in MIDI sequence
  }
}

// MIDI note loading and playback
const midi = new Midi(midiData)
const chordNotes = this.midiNotes[this.currentNoteIdx]
chordNotes.forEach(note => this.playWebAudioNote(note.frequency, note.duration))
```

### MIDI Integration
- **Primary Mode**: Loads `media/akaza's-love-theme.mid` and plays notes sequentially
- **Chord Support**: Groups simultaneous MIDI notes into chords for rich harmonies  
- **Automatic Reset**: Loops back to beginning when reaching end of MIDI file
- **Fallback Scales**: Uses predefined scales when MIDI file unavailable

### Musical Scales (Fallback)
Predefined scales in `SCALES` object:
- **Pentatonic**: C, D, E, G, A (default - most pleasant)
- **Major**: Full C major scale
- **Minor**: C minor scale  
- **Chromatic**: All 12 semitones

## Development Workflow

### Building & Linting
- **Lint**: `npm run efix` (ESLint with auto-fix)
- **Test Extension**: F5 in VS Code to launch Extension Development Host

### Code Standards
- **JavaScript**: ES2022 target with Node16 modules
- **ESLint**: Custom rules including `curly: ['error', 'multi-or-nest']` for conditional formatting
- **Audio Fallback**: Status bar musical symbols when Web Audio API unavailable

## Extension Patterns

### Event-Driven Architecture
- **Document Changes**: `vscode.workspace.onDidChangeTextDocument()` for keystroke detection
- **Configuration**: `vscode.workspace.onDidChangeConfiguration()` for settings updates
- **Lifecycle Management**: Proper disposal in `deactivate()` function

### MIDI File Processing
```javascript
// MIDI parsing pattern (similar to garage example)
midi.tracks.forEach(track => {
  track.notes.forEach(note => {
    allNotes.push({
      frequency: 440 * Math.pow(2, (note.midi - 69) / 12),
      duration: note.duration,
      time: note.time
    })
  })
})
```

### Web Audio Integration
```javascript
// Note generation with duration support
const oscillator = this.audioContext.createOscillator()
const gainNode = this.audioContext.createGain()
oscillator.frequency.value = frequency
oscillator.type = 'triangle' // Soft waveform
const playDuration = Math.max(duration, 0.3)
gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + playDuration)
```

### Configuration System
User settings in `contributes.configuration`:
- `akazas-love.enabled`: Boolean toggle
- `akazas-love.volume`: Number (0.0-1.0)  
- `akazas-love.scale`: Enum of musical scales (fallback only)

### Commands
- `akazas-love.toggleMusic`: Enable/disable musical typing
- `akazas-love.reloadMidi`: Reload MIDI theme file

### Activation & Performance
- **Activation**: `onStartupFinished` for immediate availability
- **MIDI Loading**: Automatic on startup with error handling
- **Keystroke Filtering**: Only single characters, excludes newlines and large pastes
- **Resource Management**: AudioContext cleanup and event listener disposal

## Audio Fallback Strategy
When Web Audio API unavailable, uses visual feedback:
- MIDI mode: ♪ symbol with note names in status bar
- Scale mode: Different symbols per character type (♪♫♯♭)

## Key Dependencies
- **Runtime**: VS Code ^1.104.0, Web Audio API (when available)
- **MIDI**: @tonejs/midi for parsing MIDI files
- **Development**: ESLint 9.x with custom curly brace rules
- **Node.js**: 22.x target with ES2022 language features