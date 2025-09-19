// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode')
const { Midi } = require('@tonejs/midi')
const path = require('path')
const fs = require('fs')
const Speaker = require('speaker')

// Musical scales for different typing experiences (fallback)
const SCALES = {
  pentatonic: [261.63, 293.66, 329.63, 392.00, 440.00], // C, D, E, G, A
  major: [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88], // C Major
  minor: [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16], // C Minor
  chromatic: [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88] // All semitones
}

// PCM Audio Synth based on tone-synth3.js (exact implementation for VS Code extensions)
class PCMSynth {
  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate
    this.speakers = []  // Array of 10 speakers for maximum overlapping playback
    this.currentSpeakerIndex = 0  // Round-robin selection
    this.audioQueue = []
    this.isPlaying = false
    this.initializeSpeakers()
    console.log('PCMSynth initialized with 10 Speaker instances for maximum overlapping')
  }

  // Initialize 10 speaker instances for maximum overlapping playback
  initializeSpeakers() {
    try {
      for (let i = 0; i < 10; i++) {
        const speaker = new Speaker({
          channels: 1,          // mono
          bitDepth: 16,         // 16-bit samples
          sampleRate: this.sampleRate
        })
        this.speakers.push(speaker)
      }
      console.log(`${this.speakers.length} Speakers initialized successfully`)
    } catch (error) {
      console.log('Failed to initialize Speakers:', error.message)
      this.speakers = []
    }
  }

  // Get next speaker in round-robin for overlapping playback
  getNextSpeaker() {
    if (this.speakers.length === 0) {
      console.log('No speakers available')
      return null
    }
    
    const speaker = this.speakers[this.currentSpeakerIndex]
    this.currentSpeakerIndex = (this.currentSpeakerIndex + 1) % this.speakers.length
    return speaker
  }

  // Convert MIDI note number to frequency (exact copy from tone-synth3.js)
  midiToFrequency(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12)
  }

  // Generate a note with ADSR envelope (optimized for fast typing with overlaps)
  generateNote(frequency, duration, startTime = 0, options = {}) {
    // --- Minimal detuning for cleaner sound ---
    const detuneCents = (Math.random() - 0.5) * 2  // Much less detuning
    const detuneRatio = Math.pow(2, detuneCents / 1200)
    const freqDetuned = frequency * detuneRatio

    // --- Use consistent duration like browser (0.7s minimum) ---
    const playDuration = Math.max(duration, 0.7)  // Match browser exactly

    // --- Velocity mapping to match browser (0.2 base volume) ---
    let velocity = options.velocity !== undefined ? options.velocity : 0.8
    let chordScale = options.chordScale !== undefined ? options.chordScale : 1
    let volume = 0.2 * velocity * chordScale  // Match browser: 0.2 base volume

    // --- Browser-like envelope (quick attack, linear release) ---
    const attack = 0.01   // 10ms attack
    const release = playDuration * 0.8   // Most of the duration is release (linear decay)

    const samples = Math.floor(this.sampleRate * playDuration)
    const startSample = Math.floor(this.sampleRate * startTime)
    const result = { samples, startSample, frequency: freqDetuned, duration: playDuration, options }
    result.buffer = Buffer.alloc(samples * 2) // 16-bit mono

    for (let i = 0; i < samples; i++) {
      const t = i / this.sampleRate

      // Quick envelope optimized for overlapping
      let envelope = 0
      if (t <= attack)
        envelope = t / attack  // Very quick attack
      else if (t <= playDuration - release)
        envelope = 1  // Sustain at full volume
      else {
        // Quick fade out at the end
        const fadeTime = t - (playDuration - release)
        envelope = 1 - (fadeTime / release)
      }
      envelope = Math.max(0, envelope)

      // Triangle oscillator (consistent with browser)
      const oscillatorValue = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freqDetuned * t))

      // Apply envelope and volume
      let amplitude = oscillatorValue * envelope * volume
      const int16 = Math.floor(amplitude * 32767)
      result.buffer.writeInt16LE(int16, i * 2)
    }

    return result
  }

  // Play a single note using next available speaker for overlapping
  playNote(frequency, duration, options = {}) {
    const speaker = this.getNextSpeaker()
    if (!speaker) {
      console.log('No speakers available')
      return false
    }

    try {
      const noteData = this.generateNote(frequency, duration, 0, options)
      
      // Write to next available speaker for overlapping playback
      speaker.write(noteData.buffer)
      
      return true
    } catch (error) {
      console.log('Error playing PCM note:', error.message)
      return false
    }
  }

  // Play multiple notes simultaneously using dedicated speaker
  playChord(notes, duration, options = {}) {
    const speaker = this.getNextSpeaker()
    if (!speaker || notes.length === 0) {
      console.log('No speakers available or no notes')
      return false
    }

    try {
      // Generate all note data
      const noteDataArray = notes.map(note => 
        this.generateNote(note.frequency, duration, 0, {
          ...options,
          velocity: note.velocity,
          chordScale: note.chordScale
        })
      )

      // Find the longest duration
      const maxSamples = Math.max(...noteDataArray.map(n => n.samples))
      const mixedBuffer = Buffer.alloc(maxSamples * 2) // 16-bit mono

      // Mix all notes together
      for (let i = 0; i < maxSamples; i++) {
        let mixedSample = 0
        
        noteDataArray.forEach(noteData => {
          if (i < noteData.samples) {
            const sample = noteData.buffer.readInt16LE(i * 2)
            mixedSample += sample
          }
        })

        // Prevent clipping and normalize by number of notes
        mixedSample = Math.max(-32767, Math.min(32767, mixedSample / notes.length))
        mixedBuffer.writeInt16LE(mixedSample, i * 2)
      }

      // Write mixed audio to dedicated speaker for this chord
      speaker.write(mixedBuffer)
      
      return true
    } catch (error) {
      console.log('Error playing PCM chord:', error.message)
      return false
    }
  }

  // Clean up speaker when done
  dispose() {
    if (this.speaker) {
      try {
        this.speaker.end()
      } catch (error) {
        console.log('Error closing speaker:', error.message)
      }
      this.speaker = null
    }
  }
}

class MusicalTyping {
  constructor(context) {
    this.context = context
    this.synth = new PCMSynth()
    this.enabled = true
    this.volume = 0.1
    this.scale = 'pentatonic'
    this.noteIndex = 0
    this.disposables = []
    this.midiNotes = [] // Will hold notes from MIDI file
    this.currentNoteIdx = 0
    
    this.loadConfiguration()
    this.loadMidiFile()
    this.setupEventListeners()
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
        
        // Gather all notes from all tracks
        const allNotes = []
        midi.tracks.forEach(track => {
          track.notes.forEach(note => {
            allNotes.push({
              midi: note.midi,
              name: note.name,
              duration: note.duration,
              time: note.time,
              frequency: 440 * Math.pow(2, (note.midi - 69) / 12), // Convert MIDI to frequency
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

    // Very short duration for fast typing overlap
    const success = this.synth.playNote(frequency, 0.12, { velocity: this.volume })
    
    if (!success) {
      // Fallback to visual feedback only if audio fails
      this.playAlternativeSound(character)
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
    // Clean up the persistent speaker
    if (this.synth)
      this.synth.dispose()
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
