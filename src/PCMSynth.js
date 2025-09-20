const Speaker = require('speaker')

/**
 * PCM Audio Synthesizer using multiple Speaker instances for overlapping playback
 * Generates triangle wave audio with ADSR envelope
 */
class PCMSynth {
  constructor(sampleRate) {
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

    // --- Generate triangle wave with ADSR envelope ---
    for (let i = 0; i < samples; i++) {
      const t = i / this.sampleRate

      // ADSR envelope calculation
      let envelope = 1
      if (t < attack)
        envelope = t / attack  // Attack phase
      else if (t > playDuration - release)
        envelope = (playDuration - t) / release  // Release phase (linear like browser)
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

  // Cleanup method
  dispose() {
    this.speakers.forEach(speaker => {
      try {
        speaker.end()
      } catch (error) {
        console.log('Error disposing speaker:', error.message)
      }
    })
    this.speakers = []
  }
}

module.exports = PCMSynth