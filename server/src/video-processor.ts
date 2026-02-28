import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import path from 'path'
import { mkdtemp, readdir, readFile, rm } from 'fs/promises'

const execFileAsync = promisify(execFile)
const YTDLP_BIN = process.env.YTDLP_PATH?.trim() || 'yt-dlp'
const FFMPEG_BIN = process.env.FFMPEG_PATH?.trim() || 'ffmpeg'

export interface ExtractedFrame {
  base64: string
  timestampMs: number
}

interface ExtractFramesOptions {
  intervalSeconds?: number
  maxFrames?: number
}

export async function extractFramesFromVideoUrl(
  videoUrl: string,
  opts: ExtractFramesOptions = {},
): Promise<ExtractedFrame[]> {
  const intervalSeconds = opts.intervalSeconds ?? 2
  const maxFrames = opts.maxFrames ?? 15
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'reelcheck-frames-'))
  const videoFile = path.join(tempDir, 'video.mp4')
  const outputPattern = path.join(tempDir, 'frame-%03d.jpg')

  try {
    // yt-dlp downloads the video (handles Instagram auth/MSE/HLS automatically)
    // --cookies-from-browser chrome passes your logged-in session to yt-dlp
    console.log(`   yt-dlp downloading: ${videoUrl.slice(0, 80)}`)
    await downloadWithYtDlp(videoUrl, videoFile)

    // ffmpeg extracts frames from the downloaded file
    const vf = `fps=1/${intervalSeconds},scale='min(640,iw)':-2`
    await execFileAsync(
      FFMPEG_BIN,
      [
        '-hide_banner',
        '-loglevel', 'error',
        '-y',
        '-i', videoFile,
        '-vf', vf,
        '-q:v', '12',
        '-frames:v', String(maxFrames),
        outputPattern,
      ],
      { windowsHide: true, maxBuffer: 1024 * 1024 * 8 },
    )

    const files = (await readdir(tempDir))
      .filter((file) => file.endsWith('.jpg'))
      .sort((a, b) => a.localeCompare(b))

    const frames: ExtractedFrame[] = []
    for (let i = 0; i < files.length; i++) {
      const fullPath = path.join(tempDir, files[i])
      const bytes = await readFile(fullPath)
      frames.push({
        base64: bytes.toString('base64'),
        timestampMs: i * intervalSeconds * 1000,
      })
    }

    return frames
  } catch (err) {
    const message = String(err)
    if (message.includes(YTDLP_BIN) && message.includes('not found')) {
      throw new Error('yt-dlp is required on the server PATH')
    }
    if (message.includes(FFMPEG_BIN) && message.includes('not found')) {
      throw new Error('ffmpeg is required on the server PATH')
    }
    throw err
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function downloadWithYtDlp(videoUrl: string, videoFile: string): Promise<void> {
  const commonArgs = [
    '--quiet',
    '--no-warnings',
    '-f', 'mp4/best[ext=mp4]/best',
    '-o', videoFile,
    videoUrl,
  ]

  try {
    await execFileAsync(
      YTDLP_BIN,
      ['--cookies-from-browser', 'chrome', ...commonArgs],
      { windowsHide: true, maxBuffer: 1024 * 1024 * 64 },
    )
  } catch (err) {
    const message = String(err)
    const cookieReadFailed =
      message.includes('Could not copy Chrome cookie database') ||
      message.includes('cookies-from-browser')

    if (!cookieReadFailed) {
      throw err
    }

    // Fallback for environments where browser cookie extraction is unavailable.
    await execFileAsync(
      YTDLP_BIN,
      commonArgs,
      { windowsHide: true, maxBuffer: 1024 * 1024 * 64 },
    )
  }
}
