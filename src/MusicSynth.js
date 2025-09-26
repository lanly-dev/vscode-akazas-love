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
    const playDuration = Math.max(duration, 1)  // Match browser behavior!

    // --- Velocity mapping (browser uses 0.2 base volume) ---
    let velocity = options.velocity !== undefined ? options.velocity : 0.8
    let chordScale = options.chordScale !== undefined ? options.chordScale : 1
    let volume = 0.2 * velocity * chordScale  // Browser Tone.js uses 0.2 base volume + chord scaling

    // --- Simplified envelope to match browser linear ramp ---
    const attack = 0.005  // Very quick attack

    const samples = Math.floor(SAMPLE_RATE * playDuration)
    const startSample = Math.floor(SAMPLE_RATE * startTime)
    const result = { samples, startSample, frequency: freqDetuned, duration: playDuration, options }
    // Output Float32Array PCM (mono, -1.0 to 1.0)
    result.floatBuffer = new Float32Array(samples)
    for (let i = 0; i < samples; i++) {
      const t = i / SAMPLE_RATE
      let envelope = 0
      if (t <= attack) envelope = t / attack
      else {
        const releasePhase = (t - attack) / (playDuration - attack)
        envelope = 1 - releasePhase
      }
      envelope = Math.max(0, envelope)
      const oscillatorValue = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freqDetuned * t))
      let amplitude = oscillatorValue * envelope * volume
      result.floatBuffer[i] = amplitude
    }
    return result
  }

  // Generate a note into an Int16Array [-32768..32767]
  static generateNotePCM16(frequency, duration, startTime, options = {}) {
    const note = this.generateNote(frequency, duration, startTime, options)
    const f = note.floatBuffer
    const len = f.length
    const int16 = new Int16Array(len)
    // Apply gentle headroom and TPDF dithering during conversion
    const headroom = 0.97 // small headroom to avoid hard clipping
    for (let i = 0; i < len; i++) {
      // TPDF dither: sum of two uniform noises in [-0.5,0.5] scaled to LSB
      const dither = (Math.random() - 0.5 + Math.random() - 0.5) * (1 / 32767)
      let v = f[i] * headroom + dither
      if (v > 1) v = 1
      else if (v < -1) v = -1
      int16[i] = v * 32767
    }
    return { ...note, int16Buffer: int16 }
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

    // Create final audio buffer as Int16Array and initialize to zeros
    const finalMix = new Float32Array(totalSamples).fill(0)

    // Generate and mix all notes
    allNotes.forEach((note, index) => {
      if (index % 50 === 0) console.log(`Processing note ${index + 1}/${allNotes.length}`)
      const noteResult = this.generateNote(
        note.frequency,
        note.duration,
        note.startTime,
        {
          ...options,
          midiNote: note.midiNote,
          velocity: note.velocity,
          chordScale: note.chordScale
        }
      )
      const startSample = Math.floor(note.startTime * SAMPLE_RATE)
      for (let i = 0; i < noteResult.samples && startSample + i < totalSamples; i++) {
        finalMix[startSample + i] += noteResult.floatBuffer[i]
        // Clamp to -1.0..1.0
        finalMix[startSample + i] = Math.max(-1.0, Math.min(1.0, finalMix[startSample + i]))
      }
    })

    // diagnostics removed

    // Apply a gentle soft clip and headroom before converting to Int16 to reduce harsh clipping
    const headroom = 0.97
    for (let i = 0; i < totalSamples; i++) {
      // soft clip using tanh-like curve; approx with Math.tanh for simplicity
      const x = finalMix[i] * headroom
      finalMix[i] = Math.tanh(x)
    }
    // Convert Float32Array to Int16Array for output with TPDF dithering
    const finalBuffer = new Int16Array(totalSamples)
    for (let i = 0; i < totalSamples; i++) {
      const dither = (Math.random() - 0.5 + Math.random() - 0.5) * (1 / 32767)
      let v = finalMix[i] + dither
      if (v > 1) v = 1
      else if (v < -1) v = -1
      finalBuffer[i] = v * 32767
    }
    // Convert Int16Array to Buffer for NativeSpeaker
    const outBuf = Buffer.from(finalBuffer.buffer)
    return outBuf
  }

}

module.exports = MusicSynth
