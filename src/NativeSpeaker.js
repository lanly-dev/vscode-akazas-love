const Speaker = require('speaker')

class NativeSpeaker {
  static streamPool = []
  static streamPoolIdx = 0

  static sendMultipleStreamsSpeaker(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      console.warn('NativeSpeaker.sendMultipleStreamsSpeaker: Invalid buffer', buffer)
      return
    }
    const maxStreams = 100
    // PCM format: 16-bit, 44.1kHz, mono
    const speakerOptions = {
      channels: 1,
      bitDepth: 16,
      sampleRate: 44100
    }
    // Initialize pool if needed
    if (NativeSpeaker.streamPool.length < maxStreams) {
      for (let i = NativeSpeaker.streamPool.length; i < maxStreams; i++) {
        try {
          const spk = new Speaker(speakerOptions)
          NativeSpeaker.streamPool.push(spk)
        } catch (e) {
          console.error('Failed to start NativeSpeaker Speaker instance:', e)
        }
      }
    }
    // Send buffer to next Speaker instance in pool (round robin)
    let spk = NativeSpeaker.streamPool[NativeSpeaker.streamPoolIdx % maxStreams]
    try {
      spk.write(buffer)
    } catch (e) {
      console.error('NativeSpeaker.sendMultipleStreamsSpeaker write error:', e)
    }
    NativeSpeaker.streamPoolIdx = (NativeSpeaker.streamPoolIdx + 1) % maxStreams
    // Avoid verbose logging per buffer to prevent stutter
  }
}

module.exports = NativeSpeaker
