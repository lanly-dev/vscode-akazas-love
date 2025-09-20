const fs = require('fs')
const pkg = require('@tonejs/midi')
const { Midi } = pkg

const SAMPLE_RATE = 44100

class MusicSynth {

  static generateNote(frequency, duration, startTime, options = {}) {

    // --- Minimal detuning for cleaner sound ---
    const detuneCents = (Math.random() - 0.5) * 2  // Much less detuning
    const detuneRatio = Math.pow(2, detuneCents / 1200)
    const freqDetuned = frequency * detuneRatio

    // --- Browser Tone.js minimum duration enforcement ---
    const playDuration = Math.max(duration, 0.7)  // Match browser behavior!

    // --- Velocity mapping (browser uses 0.2 base volume) ---
    let velocity = options.velocity !== undefined ? options.velocity : 0.8
    let chordScale = options.chordScale !== undefined ? options.chordScale : 1
    let volume = 0.2 * velocity * chordScale  // Browser Tone.js uses 0.2 base volume + chord scaling

    // --- Simplified envelope to match browser linear ramp ---
    const attack = 0.005  // Very quick attack

    const samples = Math.floor(SAMPLE_RATE * playDuration)
    const startSample = Math.floor(SAMPLE_RATE * startTime)
    const result = { samples, startSample, frequency: freqDetuned, duration: playDuration, options }
    result.buffer = Buffer.alloc(samples * 2) // 16-bit mono

    for (let i = 0; i < samples; i++) {
      const t = i / SAMPLE_RATE

      // Browser-like envelope: quick attack, then linear ramp down
      let envelope = 0
      if (t <= attack) envelope = t / attack  // Quick attack
      else {
        // Linear ramp to zero (like browser linearRampToValueAtTime)
        const releasePhase = (t - attack) / (playDuration - attack)
        envelope = 1 - releasePhase
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

  static async getMidiFileBuffer(midiFilePath, options = {}) {
    const midiData = fs.readFileSync(midiFilePath)
    const midi = new Midi(midiData)

    console.log(`Parsing MIDI file: ${midiFilePath}`)
    console.log(`Duration: ${midi.duration.toFixed(2)} seconds`)
    console.log(`Tracks: ${midi.tracks.length}`)

    let allNotes = []

    midi.tracks.forEach((track, trackIndex) => {
      console.log(`Track ${trackIndex}: ${track.name || 'Untitled'} - ${track.notes.length} notes`)

      track.notes.forEach(note => {
        const frequency = 440 * Math.pow(2, (note.midi - 69) / 12)

        // Debug: Check actual durations from @tonejs/midi
        if (note.duration < 0.1) console.warn(`Short note found: ${note.name} duration: ${note.duration.toFixed(3)}s`)

        allNotes.push({
          frequency,
          startTime: note.time,
          duration: note.duration, // can alert to change the speed
          velocity: note.velocity * 1.5, // volume
          midiNote: note.midi,
          noteName: note.name
        })
      })
    })

    console.log(`Found ${allNotes.length} notes`)

    // Sort by start time
    allNotes.sort((a, b) => a.startTime - b.startTime)

    // Calculate total duration
    const totalDuration = Math.max(midi.duration, Math.max(...allNotes.map(n => n.startTime + n.duration))) + 1
    const totalSamples = Math.floor(SAMPLE_RATE * totalDuration)

    console.log(`Total duration: ${totalDuration.toFixed(2)} seconds`)

    // Group notes by time frame for chord volume scaling (like browser)
    const timeFrames = new Map()
    allNotes.forEach(note => {
      const timeKey = Math.floor(note.startTime * 10) / 10  // 0.1s precision
      if (!timeFrames.has(timeKey)) timeFrames.set(timeKey, [])
      timeFrames.get(timeKey).push(note)
    })

    // Apply chord scaling to each note
    allNotes.forEach(note => {
      const timeKey = Math.floor(note.startTime * 10) / 10
      const chordSize = timeFrames.get(timeKey).length
      note.chordScale = 1 / chordSize  // Volume scaling for chords
    })

    // Create final audio buffer
    const finalBuffer = Buffer.alloc(totalSamples * 2)

    // Generate and mix all notes
    allNotes.forEach((note, index) => {
      if (index % 50 === 0) console.log(`Processing note ${index + 1}/${allNotes.length}`)

      // Pass midiNote and velocity for waveform/volume selection
      const noteResult = this.generateNote(
        note.frequency,
        note.duration,
        note.startTime,
        {
          ...options,
          midiNote: note.midiNote,
          velocity: note.velocity,
          chordScale: note.chordScale  // Apply chord volume scaling
        }
      )

      // Mix into final buffer
      const startSample = Math.floor(note.startTime * SAMPLE_RATE)
      for (let i = 0; i < noteResult.samples && startSample + i < totalSamples; i++) {
        const existingValue = finalBuffer.readInt16LE((startSample + i) * 2)
        const newValue = noteResult.buffer.readInt16LE(i * 2)
        const mixed = Math.max(-32768, Math.min(32767, existingValue + newValue))
        finalBuffer.writeInt16LE(mixed, (startSample + i) * 2)
      }
    })
    return finalBuffer
  }

}

module.exports = MusicSynth
