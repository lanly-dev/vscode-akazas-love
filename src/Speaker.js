const vscode = require('vscode')
const fs = require('fs')
const path = require('path')
const { https } = require('follow-redirects')
const { spawn } = require('child_process')

const PLAY_BUFFER_MODE = '--stream-callback'

class Speaker {

  static CHUNK_SIZE = 2048 // bytes
  static binaryPath = null
  static binaryReady = false
  static binaryDownloading = false
  static persistentProcess = null

  static async downloadPlayBuffer(context, force = false) {
    if (Speaker.binaryReady && !force) return
    if (Speaker.binaryDownloading) {
      vscode.window.showWarningMessage('play-buffer binary is downloading')
      return
    }
    Speaker.binaryDownloading = true
    const platform = process.platform
    let assetSuffix = ''
    if (platform === 'win32') assetSuffix = '.exe'
    else if (platform === 'darwin') assetSuffix = '-macos'
    else if (platform === 'linux') assetSuffix = '-linux'
    else {
      vscode.window.showWarningMessage('Unsupported platform for play-buffer')
      Speaker.binaryDownloading = false
      throw new Error('Unsupported platform')
    }
    // Fetch latest release info from GitHub API
    const apiUrl = 'https://api.github.com/repos/lanly-dev/play-buffer/releases/latest'
    const releaseInfo = await new Promise((resolve, reject) => {
      https.get(apiUrl, { headers: { 'User-Agent': 'akazas-love-extension' } }, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch (e) { reject(e) }
        })
      }).on('error', reject)
    })

    // Find correct asset for platform
    const asset = releaseInfo.assets.find(a => a.name.endsWith(assetSuffix))
    if (!asset) {
      vscode.window.showWarningMessage('No compatible play-buffer binary found in latest release')
      Speaker.binaryDownloading = false
      throw new Error('No compatible binary')
    }

    Speaker.binaryPath = path.join(context.extensionPath, 'bin', asset.name)
    const binDir = path.dirname(Speaker.binaryPath)
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true })
    if (fs.existsSync(Speaker.binaryPath)) {
      Speaker.binaryReady = true
      Speaker.binaryDownloading = false
      vscode.window.showInformationMessage('play-buffer binary downloaded')
      return
    }
    // Download the asset (auto-follows redirects)
    await new Promise((resolve, reject) => {
      https.get(asset.browser_download_url, (response) => {
        if (response.statusCode !== 200) {
          let errorBody = ''
          response.on('data', chunk => errorBody += chunk)
          response.on('end', () => {
            vscode.window.showWarningMessage('Failed to download play-buffer binary: ' + response.statusCode)
            console.error('Download error body:', errorBody)
            Speaker.binaryDownloading = false
            reject(new Error('Download failed: ' + response.statusCode))
          })
          return
        }
        const contentType = response.headers['content-type'] || ''
        // Accept typical binary content types; GitHub may omit or vary
        const isBinary = contentType.includes('octet-stream') || contentType.includes('binary') || contentType === ''
        if (!isBinary) {
          let errorBody = ''
          response.on('data', chunk => errorBody += chunk)
          response.on('end', () => {
            vscode.window.showWarningMessage('Downloaded file is not a binary. Content-Type: ' + contentType)
            console.error('Non-binary download body:', errorBody)
            Speaker.binaryDownloading = false
            reject(new Error('Non-binary file: ' + contentType))
          })
          return
        }
        const file = fs.createWriteStream(Speaker.binaryPath)
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          try { if (platform !== 'win32') fs.chmodSync(Speaker.binaryPath, '755') } catch { }
          Speaker.binaryReady = true
          Speaker.binaryDownloading = false
          vscode.window.showInformationMessage('play-buffer binary downloaded')
          resolve()
        })
        file.on('error', (err) => {
          Speaker.binaryDownloading = false
          reject(err)
        })
      }).on('error', (err) => {
        Speaker.binaryDownloading = false
        reject(err)
      })
    })
  }

  // Round-robin pool of up to 10 persistent play-buffer processes
  static streamPool = []
  static streamPoolIdx = 0
  static sendToMultipleStreamsSpeaker(buffer) {
    console.log('Speaker.sendToMultipleStreamsSpeaker buffer length:', buffer.length, Speaker.streamPoolIdx)
    if (!Speaker.binaryPath || !fs.existsSync(Speaker.binaryPath)) {
      vscode.window.showWarningMessage('play-buffer binary not found or not downloaded')
      return
    }
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      console.warn('Speaker.sendToMultipleStreams: Invalid buffer', buffer)
      return
    }
    const maxStreams = 200
    // Initialize pool if needed
    if (Speaker.streamPool.length < maxStreams) {
      for (let i = Speaker.streamPool.length; i < maxStreams; i++) {
        try {
          const proc = spawn(Speaker.binaryPath, [PLAY_BUFFER_MODE], { stdio: ['pipe', 'ignore', 'ignore'] })
          proc.on('error', (err) => {
            console.error('play-buffer pool process error:', err)
          })
          proc.on('exit', () => {
            // Remove dead process from pool
            Speaker.streamPool[i] = null
          })
          Speaker.streamPool.push(proc)
        } catch (e) {
          console.error('Failed to start pool process:', e)
        }
      }
    }
    // Send buffer to next process in pool (round robin)
    let proc = Speaker.streamPool[Speaker.streamPoolIdx % maxStreams]
    if (!proc || proc.killed) {
      // Restart dead process
      try {
        proc = spawn(Speaker.binaryPath, [PLAY_BUFFER_MODE], { stdio: ['pipe', 'ignore', 'ignore'] })
        proc.on('error', (err) => {
          console.error('play-buffer pool process error:', err)
        })
        proc.on('exit', () => {
          Speaker.streamPool[Speaker.streamPoolIdx % maxStreams] = null
        })
        Speaker.streamPool[Speaker.streamPoolIdx % maxStreams] = proc
      } catch (e) {
        console.error('Failed to restart pool process:', e)
        return
      }
    }
    try {
      proc.stdin.write(buffer)
    } catch (e) {
      console.error('Speaker.sendToMultipleStreamsSpeaker write error:', e)
    }
    Speaker.streamPoolIdx = (Speaker.streamPoolIdx + 1) % maxStreams
  }

  static startPersistentProcess() {
    // Only supported on Windows for now
    if (process.platform !== 'win32') return
    if (Speaker.persistentProcess && !Speaker.persistentProcess.killed) return
    if (!Speaker.binaryPath || !fs.existsSync(Speaker.binaryPath)) return
    try {
      Speaker.persistentProcess = spawn(Speaker.binaryPath, [PLAY_BUFFER_MODE], {
        stdio: ['pipe', 'ignore', 'ignore']
      })
      Speaker.persistentProcess.on('error', (err) => {
        console.error('play-buffer process error:', err)
        vscode.window.showWarningMessage('play-buffer process error: ' + err.message)
        Speaker.persistentProcess = null
      })
      Speaker.persistentProcess.on('exit', () => {
        Speaker.persistentProcess = null
      })
    } catch (e) {
      console.error('Failed to start play-buffer process:', e)
      vscode.window.showWarningMessage('Failed to start play-buffer process: ' + e.message)
    }
  }

  static stopPersistentProcess() {
    if (Speaker.persistentProcess && !Speaker.persistentProcess.killed) {
      try { Speaker.persistentProcess.stdin.end() } catch { }
      try { Speaker.persistentProcess.kill() } catch { }
    }
    Speaker.persistentProcess = null
    Speaker.pumpRunning = false
    Speaker.activeNotes = []
  }

  static sendToSpeaker(buffer) {
    if (!Speaker.binaryPath || !fs.existsSync(Speaker.binaryPath)) {
      vscode.window.showWarningMessage('play-buffer binary not found or not downloaded')
      return
    }
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      vscode.window.showWarningMessage('PCM buffer is invalid or empty')
      console.warn('Speaker.sendToSpeaker: Invalid buffer', buffer)
      return
    }
    // PCM format checks (assume 16-bit signed, 44.1kHz, mono)
    const expectedSampleRate = 44100
    const expectedChannels = 1
    const expectedBitDepth = 16
    // Log buffer info
    console.log('Speaker.sendToSpeaker:', {
      binaryPath: Speaker.binaryPath,
      bufferLength: buffer.length,
      firstBytes: buffer.slice(0, 32),
      stats: {
        min: buffer.length > 0 ? buffer.reduce((a, b) => Math.min(a, b), 32767) : null,
        max: buffer.length > 0 ? buffer.reduce((a, b) => Math.max(a, b), -32768) : null
      },
      format: {
        sampleRate: expectedSampleRate,
        channels: expectedChannels,
        bitDepth: expectedBitDepth
      }
    })
    // Optionally, warn if buffer length is suspiciously small
    if (buffer.length < expectedSampleRate * expectedChannels * (expectedBitDepth / 8) * 0.1)
      vscode.window.showWarningMessage('PCM buffer is very short (less than 0.1s)')
    try {
      const playProcess = spawn(Speaker.binaryPath, [], {
        stdio: ['pipe', 'ignore', 'ignore']
      })
      playProcess.stdin.write(buffer)
      playProcess.stdin.end()
      playProcess.on('error', (err) => {
        vscode.window.showWarningMessage('Failed to play buffer: ' + err.message)
        console.error('Speaker.sendToSpeaker spawn error:', err)
      })
    } catch (e) {
      vscode.window.showWarningMessage('Failed to play buffer: ' + e.message)
      console.error('Speaker.sendToSpeaker catch error:', e)
    }
  }

  static sendToStreamSpeaker(buffer) {
    if (!Speaker.binaryPath || !fs.existsSync(Speaker.binaryPath)) {
      vscode.window.showWarningMessage('play-buffer binary not found or not downloaded')
      return
    }
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      console.warn('Speaker.sendToSpeaker: Invalid buffer', buffer)
      return
    }
    // Ensure persistent process is running
    Speaker.startPersistentProcess()
    if (!Speaker.persistentProcess || Speaker.persistentProcess.killed) {
      vscode.window.showWarningMessage('Persistent play-buffer process is not running')
      return
    }
    try {
      for (let i = 0; i < buffer.length; i += Speaker.CHUNK_SIZE) {
        const chunk = buffer.slice(i, i + Speaker.CHUNK_SIZE)
        Speaker.persistentProcess.stdin.write(chunk)
      }
    } catch (e) {
      console.error('Speaker.sendToStreamSpeaker error:', e)
    }
  }
}

module.exports = Speaker
