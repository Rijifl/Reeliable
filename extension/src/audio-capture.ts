// Captures audio from <video> via AudioContext + MediaStreamDestination
// Note: In Manifest V3 this runs in the offscreen document, not here directly.
// This module provides helper types and utilities shared by offscreen.ts.

export interface AudioCaptureOptions {
  onChunk: (chunk: Blob) => void
  chunkIntervalMs?: number
}

export class AudioCapture {
  private recorder: MediaRecorder | null = null

  async start(stream: MediaStream, opts: AudioCaptureOptions) {
    this.recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) opts.onChunk(e.data)
    }
    this.recorder.start(opts.chunkIntervalMs ?? 250)
  }

  stop() {
    this.recorder?.stop()
    this.recorder = null
  }
}
