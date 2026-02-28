// Batch embed passages via OpenAI text-embedding-3-small
import OpenAI from 'openai'
import { Passage } from './types.js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const BATCH_SIZE = 100

export interface EmbeddedPassage extends Passage {
  vector: number[]
}

export async function embedPassages(passages: Passage[]): Promise<EmbeddedPassage[]> {
  const result: EmbeddedPassage[] = []

  for (let i = 0; i < passages.length; i += BATCH_SIZE) {
    const batch = passages.slice(i, i + BATCH_SIZE)
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch.map((p) => p.text),
    })
    for (let j = 0; j < batch.length; j++) {
      result.push({ ...batch[j], vector: res.data[j].embedding })
    }
    console.log(`  Embedded ${Math.min(i + BATCH_SIZE, passages.length)}/${passages.length}`)
  }

  return result
}
