const vscode = require('vscode')
const { Midi } = require('@tonejs/midi')
const fs = require('fs')
const path = require('path')
const Speaker = require('./Speaker')
const MusicSynth = require('./MusicSynth')

class MusicalTyping {
  #notes
  #currentNoteIdx

  constructor(context) {
    this.context = context
    this.midiPath = path.join(this.context.extensionPath, 'media', `akaza's-love-theme.mid`)

    // Configuration
    this.enabled = true
    this.volume = 0.1

    this.#notes = []
    this.#currentNoteIdx = 0

    this.#loadConfiguration()
    this.#loadMidiFile()
    this.#setupEventListeners()
  }

  #loadConfiguration() {
    const config = vscode.workspace.getConfiguration('akazas-love')
    this.enabled = config.get('enabled', true)
    this.volume = config.get('volume', 0.1)
  }

  async #loadMidiFile() {
    const midiData = fs.readFileSync(this.midiPath)
    const midi = new Midi(midiData)

    // Gather all notes from all tracks (same as index.html)
    let allNotes = []
    midi.tracks.forEach(track => {
      track.notes.forEach(note => {
        allNotes.push({
          midi: note.midi,
          name: note.name,
          duration: note.duration,
          time: note.time,
          frequency: 440 * Math.pow(2, (note.midi - 69) / 12),
          velocity: note.velocity * 1.5
        })
      })
      // Group notes by their exact time for proper chord detection
      const timeMap = {}
      allNotes.forEach(note => {
        const timeKey = note.time  // Use exact time for precise chord grouping
        if (!timeMap[timeKey]) timeMap[timeKey] = []
        timeMap[timeKey].push(note)
      })

      // Sort time frames and create note sequence with chord scaling (like index.html)
      const timeFrames = Object.keys(timeMap).map(Number).sort((a, b) => a - b)
      this.#notes = timeFrames.map(t => {
        const chordNotes = timeMap[t]
        const chordSize = chordNotes.length
        // Apply chord scaling to each note
        return chordNotes.map(note => ({
          ...note,
          chordScale: 1 / chordSize  // Volume scaling for chords
        }))
      })

      console.log(`Loaded MIDI file with ${this.#notes.length} note groups`)
    })
  }

  #setupEventListeners() {
    // Listen for text document changes (typing)
    const changeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
      if (this.enabled && event.contentChanges.length > 0) {
        // Only play sound for actual typing (not large pastes)
        const change = event.contentChanges[0]
        if (change.text.length === 1 && (change.text === '\n' || change.text === '\r\n')) return
        this.playMidiNotes(change.text)
      }
    })

    // Listen for configuration changes
    const configDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('akazas-love')) return
      this.#loadConfiguration()
    })
    this.context.subscriptions.push(changeDisposable, configDisposable)
  }

  playMidiNotes() {
    if (this.#currentNoteIdx >= this.#notes.length) this.#currentNoteIdx = 0 // Loop back to beginning
    const chordNotes = this.#notes[this.#currentNoteIdx]

    // Play each note separately
    chordNotes.forEach(note => {
      // Use minimum duration for consistent overlapping
      const playDuration = Math.max(note.duration, .3)

      // Create a single note "song" for MusicSynth to play
      this.playIndividualNote(note.frequency, playDuration, {
        velocity: note.velocity * this.volume,
        chordScale: note.chordScale
      })
    })

    // Show current notes in status bar
    const noteNames = chordNotes.map(n => n.name).join('+')
    const frequencies = chordNotes.map(n => `${n.frequency.toFixed(1)}Hz`).join(', ')
    vscode.window.setStatusBarMessage(`🎵 ${noteNames} (${frequencies})`, 1500)

    this.#currentNoteIdx++
  }

  async playIndividualNote(frequency, duration, options) {
    // PortAudio path: stream via play-buffer binary (expects Int16)
    const noteResult = MusicSynth.generateNotePCM16(frequency, duration, 0, options)
    const pcmBuffer = Buffer.from(noteResult.int16Buffer.buffer)
    Speaker.sendToMultipleStreamsSpeaker(pcmBuffer)

    // Visual feedback
    const noteName = MusicalTyping.#frequencyToNoteName(frequency)
    vscode.window.setStatusBarMessage(`♪ ${noteName}`, 800)
  }

  // Convert frequency back to note name for display
  static #frequencyToNoteName(frequency) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const midiNote = Math.round(69 + 12 * Math.log2(frequency / 440))
    const octave = Math.floor(midiNote / 12) - 1
    const noteIndex = midiNote % 12
    return `${noteNames[noteIndex]}${octave}`
  }

  toggleEnabled() {
    this.enabled = !this.enabled
    const message = this.enabled ? 'Musical typing enabled' : 'Musical typing disabled'
    vscode.window.showInformationMessage(message)
  }

  async reloadMidi() {
    this.#currentNoteIdx = 0
    await this.loadMidiFile()
    vscode.window.showInformationMessage('MIDI theme reloaded')
  }

  static async playMidiFile(midiPath) {
    // This static method doesn't have instance config; default to portaudio for full-file playback
    Speaker.sendToStreamSpeaker(await MusicSynth.getMidiFileBuffer(midiPath))
  }
}

module.exports = MusicalTyping