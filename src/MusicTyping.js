const { Midi } = require('@tonejs/midi')
const fs = require('fs')
const path = require('path')
const vscode = require('vscode')

const Speaker = require('./Speaker')
const MusicSynth = require('./MusicSynth')

class MusicalTyping {

  static #context
  static #midiPath

  static #enabled
  static #volume

  static #currentNoteIdx
  static #notes

  static init(context) {
    this.#context = context
    this.#midiPath = path.join(this.#context.extensionPath, 'media', `akaza's-love-theme.mid`)

    this.#notes = []
    this.#currentNoteIdx = 0

    this.#loadConfiguration()
    this.#loadMidiFile()
    this.#setupEventListeners()

    this.stopBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
    this.stopBtn.command = 'akazas-love.stopSong'
    this.stopBtn.text = '⏹️ Stop'
    this.#context.subscriptions.push(this.stopBtn)
  }

  static async playMidiFile(needPlay) {
    if (needPlay) {
      Speaker.sendToSpeaker(await MusicSynth.getMidiFileBuffer(MusicalTyping.#midiPath))
      this.stopBtn.show()
    } else {
      Speaker.stopToSpeaker()
      this.stopBtn.hide()
    }
  }

  static playIndividualNote(frequency, duration, options) {
    const noteResult = MusicSynth.generateNote(frequency, duration, 0, options)
    const pcmBuffer = Buffer.from(noteResult.floatBuffer.buffer)
    Speaker.sendToMultipleStreamsSpeaker(pcmBuffer)

    // Visual feedback
    const noteName = MusicalTyping.#frequencyToNoteName(frequency)
    vscode.window.setStatusBarMessage(`♪ ${noteName}`, 800)
  }

  static #loadConfiguration() {
    const config = vscode.workspace.getConfiguration('akazas-love')
    this.#enabled = config.get('musicTyping')
    this.#volume = config.get('volume')
  }

  static #setupEventListeners() {
    // Listen for text document changes (typing)
    const changeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
      // Only play sound for actual typing (not large pastes)
      if (!this.#enabled || !event.contentChanges.length) return
      const change = event.contentChanges[0]
      if (change.text.length === 1 && (change.text === '\n' || change.text === '\r\n')) return
      try {
        this.#playMidiNotes(change.text)
      } catch (error) {
        console.error('Error playing MIDI notes:', error)
      }
    })

    // Listen for configuration changes
    const configDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('akazas-love.musicTyping')) return
      this.#loadConfiguration()
      const message = this.#enabled ? '🎶 Musical typing enabled' : '⛔ Musical typing disabled'
      vscode.window.setStatusBarMessage(message, 3000)
    })
    this.#context.subscriptions.push(changeDisposable, configDisposable)
  }

  static #playMidiNotes() {
    if (this.#currentNoteIdx >= this.#notes.length) this.#currentNoteIdx = 0 // Loop back to beginning
    const chordNotes = this.#notes[this.#currentNoteIdx]

    // Play each note separately
    chordNotes.forEach(note => {
      // Use minimum duration for consistent overlapping
      const playDuration = Math.max(note.duration, .3)

      // Create a single note "song" for MusicSynth to play
      this.playIndividualNote(note.frequency, playDuration, {
        velocity: note.velocity * this.#volume,
        chordScale: note.chordScale
      })
    })

    // Show current notes in status bar
    const noteNames = chordNotes.map(n => n.name).join('+')
    const frequencies = chordNotes.map(n => `${n.frequency.toFixed(1)}Hz`).join(', ')
    vscode.window.setStatusBarMessage(`🎵 ${noteNames} (${frequencies})`, 1500)

    this.#currentNoteIdx++
  }

  static #loadMidiFile() {
    const midiData = fs.readFileSync(this.#midiPath)
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

  // Convert frequency back to note name for display
  static #frequencyToNoteName(frequency) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const midiNote = Math.round(69 + 12 * Math.log2(frequency / 440))
    const octave = Math.floor(midiNote / 12) - 1
    const noteIndex = midiNote % 12
    return `${noteNames[noteIndex]}${octave}`
  }
}

module.exports = MusicalTyping
