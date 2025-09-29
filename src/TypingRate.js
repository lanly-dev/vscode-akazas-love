// TypingRateTracker.js
// Utility to track user typing rate (keystrokes per second)

class TypingRate {
  constructor(windowMs = 2000) {
    this.windowMs = windowMs // Time window in ms for rate calculation
    this.timestamps = [] // Array of Date.now() for each keypress
  }

  recordKeystroke() {
    const now = Date.now()
    this.timestamps.push(now)
    // Remove old timestamps outside the window
    while (this.timestamps.length && now - this.timestamps[0] > this.windowMs) this.timestamps.shift()
  }

  getRate() {
    const now = Date.now()
    // Remove old timestamps
    while (this.timestamps.length && now - this.timestamps[0] > this.windowMs) this.timestamps.shift()
    if (this.timestamps.length < 2) return 0
    // Rate: keystrokes per second
    return this.timestamps.length / (this.windowMs / 1000)
  }
}

module.exports = TypingRate
