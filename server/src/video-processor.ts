import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import path from 'path'
import { mkdtemp, readdir, readFile, rm } from 'fs/promises'
import { transcribeAudio } from './transcription.js'

const execFileAsync = promisify(execFile)

export interface ExtractedFrame {
  base64: string
  timestampMs: number
}

export interface ExtractResult {
  frames: ExtractedFrame[]
  whisperTranscript?: string
}

interface ExtractFramesOptions {
  intervalSeconds?: number
  maxFrames?: number
}

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.mkv'])
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

export async function extractFramesFromVideoUrl(
  mediaUrl: string,
  opts: ExtractFramesOptions = {},
  imageUrls?: string[],
): Promise<ExtractResult> {
  // Image post: fetch CDN URLs directly — no yt-dlp or audio needed
  if (imageUrls && imageUrls.length > 0) {
    console.log(`   fetching ${imageUrls.length} image(s) directly from CDN`)
    const frames = await fetchImagesAsFrames(imageUrls.slice(0, opts.maxFrames ?? 15))
    return { frames }
  }

  const intervalSeconds = opts.intervalSeconds ?? 2
  const maxFrames = opts.maxFrames ?? 15
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'reelcheck-frames-'))

  try {
    console.log(`   yt-dlp downloading: ${mediaUrl.slice(0, 80)}`)
    await downloadMedia(mediaUrl, tempDir)

    const files = await readdir(tempDir)
    const videoFile = files.find(f => VIDEO_EXTS.has(path.extname(f).toLowerCase()))
    const imageFiles = files
      .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, maxFrames)

    if (videoFile) {
      const videoPath = path.join(tempDir, videoFile)
      const [frames, whisperTranscript] = await Promise.all([
        extractFramesFromVideo(videoPath, tempDir, intervalSeconds, maxFrames),
        extractAndTranscribeAudio(videoPath, tempDir),
      ])
      return { frames, whisperTranscript: whisperTranscript || undefined }
    }

    if (imageFiles.length > 0) {
      const frames = await loadImagesAsFrames(imageFiles.map(f => path.join(tempDir, f)))
      return { frames }
    }

    throw new Error('yt-dlp downloaded no usable media files')
  } catch (err) {
    const message = String(err)
    if (message.includes('yt-dlp') && message.includes('not found')) {
      throw new Error('yt-dlp is required on the server PATH')
    }
    if (message.includes('ffmpeg') && message.includes('not found')) {
      throw new Error('ffmpeg is required on the server PATH')
    }
    throw err
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function downloadMedia(url: string, tempDir: string): Promise<void> {
  const ytdlpBase = [
    '--quiet', '--no-warnings',
    '--cookies-from-browser', 'chrome',
  ]

  try {
    // First attempt: download as video (works for reels/video posts)
    await execFileAsync(
      'yt-dlp',
      [...ytdlpBase, '-o', path.join(tempDir, 'media.%(ext)s'), url],
      { windowsHide: true, maxBuffer: 1024 * 1024 * 128 },
    )
  } catch (err) {
    const msg = String(err)
    if (!msg.includes('No video formats found')) throw err

    // Fallback: image post — download the thumbnail (= the actual image)
    console.log('   image post detected, downloading thumbnail')
    await execFileAsync(
      'yt-dlp',
      [
        ...ytdlpBase,
        '--write-thumbnail',
        '--convert-thumbnails', 'jpg',
        '--skip-download',
        '-o', path.join(tempDir, 'media'),
        url,
      ],
      { windowsHide: true, maxBuffer: 1024 * 1024 * 32 },
    )
  }
}

async function extractAndTranscribeAudio(videoFile: string, tempDir: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) return ''

  const audioFile = path.join(tempDir, 'audio.mp3')
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner', '-loglevel', 'error',
        '-y', '-i', videoFile,
        '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '4',
        audioFile,
      ],
      { windowsHide: true, maxBuffer: 1024 * 1024 * 8 },
    )
  } catch {
    console.warn('   audio extraction failed, skipping transcription')
    return ''
  }

  console.log('   sending audio to Groq Whisper...')
  const transcript = await transcribeAudio(audioFile)
  if (transcript) console.log(`   whisper transcript: ${transcript.slice(0, 80)}...`)
  return transcript
}

async function extractFramesFromVideo(
  videoFile: string,
  tempDir: string,
  intervalSeconds: number,
  maxFrames: number,
): Promise<ExtractedFrame[]> {
  const outputPattern = path.join(tempDir, 'frame-%03d.jpg')
  const vf = `fps=1/${intervalSeconds},scale='min(640,iw)':-2`

  await execFileAsync(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error',
      '-y', '-i', videoFile,
      '-vf', vf,
      '-q:v', '4',
      '-frames:v', String(maxFrames),
      outputPattern,
    ],
    { windowsHide: true, maxBuffer: 1024 * 1024 * 8 },
  )

  const frameFiles = (await readdir(tempDir))
    .filter(f => f.startsWith('frame-') && f.endsWith('.jpg'))
    .sort((a, b) => a.localeCompare(b))

  return Promise.all(
    frameFiles.map(async (file, i) => ({
      base64: (await readFile(path.join(tempDir, file))).toString('base64'),
      timestampMs: i * intervalSeconds * 1000,
    })),
  )
}

async function loadImagesAsFrames(imagePaths: string[]): Promise<ExtractedFrame[]> {
  return Promise.all(
    imagePaths.map(async (filePath, i) => ({
      base64: (await readFile(filePath)).toString('base64'),
      timestampMs: i * 1000,
    })),
  )
}

async function fetchImagesAsFrames(urls: string[]): Promise<ExtractedFrame[]> {
  return Promise.all(
    urls.map(async (url, i) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch image ${url}: ${res.status}`)
      const buf = await res.arrayBuffer()
      return { base64: Buffer.from(buf).toString('base64'), timestampMs: i * 1000 }
    }),
  )
}
