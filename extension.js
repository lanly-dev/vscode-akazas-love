// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode')
const { Midi } = require('@tonejs/midi')
const path = require('path')
const fs = require('fs')

// Musical scales for different typing experiences (fallback)
const SCALES = {
  pentatonic: [261.63, 293.66, 329.63, 392.00, 440.00], // C, D, E, G, A
  major: [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88], // C Major
  minor: [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16], // C Minor
  chromatic: [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88] // All semitones
}

class MusicalTyping {
  constructor(context) {
    this.context = context
    this.audioContext = null
    this.enabled = true
    this.volume = 0.1
    this.scale = 'pentatonic'
    this.noteIndex = 0
    this.disposables = []
    this.midiNotes = [] // Will hold notes from MIDI file
    this.currentNoteIdx = 0
    
    this.initializeAudioContext()
    this.loadConfiguration()
    this.loadMidiFile()
    this.setupEventListeners()
  }

  initializeAudioContext() {
    try {
      // Note: Web Audio API in VS Code extension context is limited
      // This is a simplified approach that may not work in all environments
      if (typeof globalThis !== 'undefined' && globalThis.AudioContext)
        this.audioContext = new globalThis.AudioContext()
      else if (typeof globalThis !== 'undefined' && globalThis.webkitAudioContext)
        this.audioContext = new globalThis.webkitAudioContext()
      else {
        console.log('Web Audio API not available in this environment')
        this.playSystemBeep = true
      }
    } catch (error) {
      console.log('Failed to initialize AudioContext:', error.message)
      this.playSystemBeep = true
    }
  }

  loadConfiguration() {
    const config = vscode.workspace.getConfiguration('akazas-love')
    this.enabled = config.get('enabled', true)
    this.volume = config.get('volume', 0.1)
    this.scale = config.get('scale', 'pentatonic')
  }

  loadMidiFile() {
    try {
      const midiPath = path.join(this.context.extensionPath, 'media', 'akaza\'s-love-theme.mid')
      if (fs.existsSync(midiPath)) {
        const midiData = fs.readFileSync(midiPath)
        const midi = new Midi(midiData)
        
        // Gather all notes from all tracks, similar to your garage example
        const allNotes = []
        midi.tracks.forEach(track => {
          track.notes.forEach(note => {
            allNotes.push({
              midi: note.midi,
              name: note.name,
              duration: note.duration,
              time: note.time,
              frequency: 440 * Math.pow(2, (note.midi - 69) / 12) // Convert MIDI to frequency
            })
          })
        })

        // Group notes by their time (frame) for chord support
        const timeMap = {}
        allNotes.forEach(note => {
          if (!timeMap[note.time]) timeMap[note.time] = []
          timeMap[note.time].push(note)
        })

        // Sort time frames and create note sequence
        const timeFrames = Object.keys(timeMap).map(Number).sort((a, b) => a - b)
        this.midiNotes = timeFrames.map(t => timeMap[t])
        
        console.log(`Loaded MIDI file with ${this.midiNotes.length} note groups`)
        vscode.window.showInformationMessage(`🎼 Loaded ${this.midiNotes.length} musical phrases from Akaza's Love theme!`)
      } else {
        console.log('MIDI file not found, using fallback scales')
        vscode.window.showWarningMessage('MIDI theme file not found, using fallback musical scales')
      }
    } catch (error) {
      console.log('Error loading MIDI file:', error.message)
      vscode.window.showWarningMessage('Error loading MIDI theme, using fallback musical scales')
    }
  }

  setupEventListeners() {
    // Listen for text document changes (typing)
    const changeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
      if (this.enabled && event.contentChanges.length > 0) {
        // Only play sound for actual typing (not large pastes)
        const change = event.contentChanges[0]
        if (change.text.length === 1 && change.text !== '\n')
          this.playNote(change.text)
      }
    })

    // Listen for configuration changes
    const configDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('akazas-love'))
        this.loadConfiguration()
    })

    this.disposables.push(changeDisposable, configDisposable)
  }

  playNote(character) {
    if (!this.enabled) return

    if (this.midiNotes.length > 0) {
      // Play MIDI notes sequentially
      this.playMidiNotes()
    } else {
      // Fallback to scale-based notes
      this.playScaleNote(character)
    }
  }

  playMidiNotes() {
    if (this.currentNoteIdx >= this.midiNotes.length) {
      // Reset to beginning when we reach the end
      this.currentNoteIdx = 0
    }

    const chordNotes = this.midiNotes[this.currentNoteIdx]
    
    // Play all notes in this time frame as a chord
    chordNotes.forEach(note => {
      if (this.audioContext && !this.playSystemBeep)
        this.playWebAudioNote(note.frequency, note.duration)
      else
        this.playAlternativeSound('♪') // Musical note for MIDI
    })

    // Show current notes in status bar
    const noteNames = chordNotes.map(n => n.name).join(' ')
    vscode.window.setStatusBarMessage(`🎵 ${noteNames}`, 1000)

    this.currentNoteIdx++
  }

  playScaleNote(character) {
    // Map character to note index using scales
    const charCode = character.charCodeAt(0)
    const scaleNotes = SCALES[this.scale] || SCALES.pentatonic
    const noteIndex = charCode % scaleNotes.length
    const frequency = scaleNotes[noteIndex]

    if (this.audioContext && !this.playSystemBeep)
      this.playWebAudioNote(frequency)
    else
      this.playAlternativeSound(character)
  }

  playWebAudioNote(frequency, duration = 0.3) {
    try {
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      oscillator.frequency.value = frequency
      oscillator.type = 'triangle' // Softer sound than 'square' or 'sawtooth'
      
      // Adjust volume for chords (lower volume when multiple notes)
      const noteVolume = this.volume
      gainNode.gain.value = noteVolume
      gainNode.gain.setValueAtTime(noteVolume, this.audioContext.currentTime)
      
      // Use the note's duration or default duration
      const playDuration = Math.max(duration, 0.3)
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + playDuration)

      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + playDuration)
    } catch (error) {
      console.log('Error playing web audio note:', error.message)
    }
  }

  playAlternativeSound(character) {
    // Fallback: Use different information messages for different character types
    // This is a creative workaround since we can't play actual audio in all VS Code environments
    if (/[aeiou]/i.test(character)) {
      // Vowels - show a musical note in status bar briefly
      vscode.window.setStatusBarMessage('♪', 200)
    } else if (/[bcdfghjklmnpqrstvwxyz]/i.test(character)) {
      // Consonants - show a different musical note
      vscode.window.setStatusBarMessage('♫', 200)
    } else if (/[0-9]/.test(character)) {
      // Numbers - show a sharp note
      vscode.window.setStatusBarMessage('♯', 200)
    } else {
      // Other characters - show a flat note
      vscode.window.setStatusBarMessage('♭', 200)
    }
  }

  toggle() {
    this.enabled = !this.enabled
    const config = vscode.workspace.getConfiguration('akazas-love')
    config.update('enabled', this.enabled, vscode.ConfigurationTarget.Global)
    
    vscode.window.showInformationMessage(
      `Musical typing ${this.enabled ? 'enabled' : 'disabled'} ${this.enabled ? '♪' : '♫'}`
    )
  }

  reloadMidi() {
    this.currentNoteIdx = 0
    this.loadMidiFile()
  }

  dispose() {
    this.disposables.forEach(disposable => disposable.dispose())
    if (this.audioContext)
      this.audioContext.close()
  }
}

let musicalTyping

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('Congratulations, your extension "akazas-love" is now active!')

  // Initialize musical typing
  musicalTyping = new MusicalTyping(context)

  // Register toggle command
  const toggleCommand = vscode.commands.registerCommand('akazas-love.toggleMusic', () => {
    musicalTyping.toggle()
  })

  // Register reload MIDI command
  const reloadCommand = vscode.commands.registerCommand('akazas-love.reloadMidi', () => {
    musicalTyping.reloadMidi()
  })

  context.subscriptions.push(toggleCommand, reloadCommand)

  // Show welcome message
  vscode.window.showInformationMessage('🎵 Akaza\'s Love: Musical typing is now active! Type to hear music ♪')
}

// This method is called when your extension is deactivated
function deactivate() {
  if (musicalTyping)
    musicalTyping.dispose()
}

module.exports = {
  activate,
  deactivate
}
