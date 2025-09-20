const vscode = require('vscode')
const { Midi } = require('@tonejs/midi')
const fs = require('fs')
const path = require('path')
const PCMSynth = require('./PCMSynth')

// Musical scales for fallback when no MIDI file
const SCALES = {
  pentatonic: [261.63, 293.66, 329.63, 392.00, 440.00], // C, D, E, G, A
  major: [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88], // C major
  minor: [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16], // C minor
  chromatic: [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88]
}

/**
 * Main Musical Typing class that handles MIDI loading, configuration, and keystroke events
 */
class MusicalTyping {
  constructor(context) {
    this.context = context
    this.synth = new PCMSynth()

    // Configuration
    this.enabled = true
    this.volume = 0.1
    this.scale = 'pentatonic'

    // MIDI playback
    this.midiNotes = []
    this.currentNoteIdx = 0

    this.loadConfiguration()
    this.loadMidiFile()
    this.setupEventListeners()

    console.log('MusicalTyping initialized')
  }

  loadConfiguration() {
    const config = vscode.workspace.getConfiguration('akazas-love')
    this.enabled = config.get('enabled', true)
    this.volume = config.get('volume', 0.1)
    this.scale = config.get('scale', 'pentatonic')
  }

  async loadMidiFile() {
    try {
      const midiPath = path.join(this.context.extensionPath, 'media', 'akaza\'s-love-theme.mid')

      if (!fs.existsSync(midiPath)) {
        console.log('MIDI file not found, using fallback scales')
        return
      }

      const midiData = fs.readFileSync(midiPath)
      const midi = new Midi(midiData)

      // Gather all notes from all tracks (same as browser version)
      const allNotes = []
      midi.tracks.forEach(track => {
        track.notes.forEach(note => {
          allNotes.push({
            midi: note.midi,
            name: note.name,
            duration: note.duration,
            time: note.time,
            frequency: this.synth.midiToFrequency(note.midi),
            velocity: note.velocity * 1.5 // Boost velocity like tone-synth3.js
          })
        })
      })

      // Group notes by their exact time (like browser) for proper chord detection
      const timeMap = {}
      allNotes.forEach(note => {
        const timeKey = note.time  // Use exact time for precise chord grouping
        if (!timeMap[timeKey]) timeMap[timeKey] = []
        timeMap[timeKey].push(note)
      })

      // Sort time frames and create note sequence with chord scaling
      const timeFrames = Object.keys(timeMap).map(Number).sort((a, b) => a - b)
      this.midiNotes = timeFrames.map(t => {
        const chordNotes = timeMap[t]
        const chordSize = chordNotes.length
        // Apply chord scaling to each note (like browser: 0.2 / chordSize)
        return chordNotes.map(note => ({
          ...note,
          chordScale: 1 / chordSize  // Volume scaling for chords
        }))
      })

      console.log(`Loaded MIDI file with ${this.midiNotes.length} note groups`)
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
        if (change && change.text.length === 1 && change.text !== '\n')
          this.playSound(change.text)
      }
    })

    // Listen for configuration changes
    const configDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('akazas-love'))
        this.loadConfiguration()

    })

    this.context.subscriptions.push(changeDisposable, configDisposable)
  }

  playSound(character) {
    if (this.midiNotes.length > 0)
      this.playMidiNotes()
    else
      this.playScaleNote(character)

  }

  playMidiNotes() {
    if (this.currentNoteIdx >= this.midiNotes.length)
      this.currentNoteIdx = 0 // Loop back to beginning


    const chordNotes = this.midiNotes[this.currentNoteIdx]

    // Play each note separately using round-robin speakers (like browser's separate oscillators)
    chordNotes.forEach(note => {
      // Use minimum duration like browser (0.7s) for consistent overlapping
      const playDuration = Math.max(note.duration, 0.7)

      const success = this.synth.playNote(note.frequency, playDuration, {
        velocity: note.velocity * this.volume,
        chordScale: note.chordScale
      })

      if (!success) {
        // Fallback to visual feedback only if audio fails
        this.playAlternativeSound('♪')
      }
    })

    // Show current notes in status bar
    const noteNames = chordNotes.map(n => n.name).join('+')
    vscode.window.setStatusBarMessage(`🎵 ${noteNames}`, 1500)

    this.currentNoteIdx++
  }

  playScaleNote(character) {
    // Map character to note index using scales
    const charCode = character.charCodeAt(0)
    const scaleNotes = SCALES[this.scale] || SCALES.pentatonic
    const noteIndex = charCode % scaleNotes.length
    const frequency = scaleNotes[noteIndex]

    const success = this.synth.playNote(frequency, 0.5, {
      velocity: this.volume,
      chordScale: 1
    })

    if (!success)
      this.playAlternativeSound('♪')


    vscode.window.setStatusBarMessage(`🎵 Scale: ${this.scale}`, 1000)
  }

  playAlternativeSound(symbol) {
    // Visual feedback when audio is not available
    vscode.window.setStatusBarMessage(`${symbol} (Audio not available)`, 1000)
  }

  toggleEnabled() {
    this.enabled = !this.enabled
    const message = this.enabled ? 'Musical typing enabled' : 'Musical typing disabled'
    vscode.window.showInformationMessage(message)
  }

  async reloadMidi() {
    this.currentNoteIdx = 0
    await this.loadMidiFile()
    vscode.window.showInformationMessage('MIDI theme reloaded')
  }

  dispose() {
    if (this.synth)
      this.synth.dispose()

  }
}

module.exports = MusicalTyping
