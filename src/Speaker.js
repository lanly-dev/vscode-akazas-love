const vscode = require('vscode')
const fs = require('fs')
const path = require('path')
const https = require('https')
const { spawn } = require('child_process')

class Speaker {
  static binaryPath = null
  static binaryReady = false
  static binaryDownloading = false

  static async downloadPlayBuffer(context, force = false) {
    if (Speaker.binaryReady && !force) return
    if (Speaker.binaryDownloading) return
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
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(e)
          }
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
      return
    }
    // Download asset
    // Helper to follow redirects
    function downloadWithRedirect(url, attempt = 0) {
      return new Promise((resolve, reject) => {
        if (attempt > 5) return reject(new Error('Too many redirects'))
        https.get(url, (response) => {
          // Handle redirect
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            return resolve(downloadWithRedirect(response.headers.location, attempt + 1))
          }
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
          const contentType = response.headers['content-type']
          if (!contentType || !contentType.includes('application/octet-stream')) {
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
            if (platform !== 'win32') fs.chmodSync(Speaker.binaryPath, '755')
            Speaker.binaryReady = true
            Speaker.binaryDownloading = false
            resolve()
          })
        }).on('error', (err) => {
          try { fs.unlinkSync(Speaker.binaryPath) } catch {}
          Speaker.binaryDownloading = false
          reject(err)
        })
      })
    }
    await downloadWithRedirect(asset.browser_download_url)
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
    if (buffer.length < expectedSampleRate * expectedChannels * (expectedBitDepth / 8) * 0.1) {
      vscode.window.showWarningMessage('PCM buffer is very short (less than 0.1s)')
    }
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
}

module.exports = Speaker
