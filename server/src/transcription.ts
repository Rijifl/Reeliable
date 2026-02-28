import { readFile } from 'fs/promises'

export async function transcribeAudio(audioPath: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return ''

  let audioData: Buffer
  try {
    audioData = await readFile(audioPath)
  } catch {
    return ''
  }

  const blob = new Blob([new Uint8Array(audioData)], { type: 'audio/mp3' })
  const form = new FormData()
  form.append('file', blob, 'audio.mp3')
  form.append('model', 'whisper-large-v3')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!res.ok) {
    console.warn(`   Groq transcription failed: ${res.status}`)
    return ''
  }

  const data = await res.json() as { text?: string }
  return data.text?.trim() ?? ''
}
