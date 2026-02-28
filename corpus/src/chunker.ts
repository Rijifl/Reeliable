// Split docs into ~200-token passages with 30-token overlap
import { CorpusDocument, Passage } from './types.js'
import crypto from 'crypto'

const CHUNK_TOKENS = 200
const OVERLAP_TOKENS = 30
// Rough approximation: 1 token ≈ 4 chars
const CHARS_PER_TOKEN = 4
const CHUNK_CHARS = CHUNK_TOKENS * CHARS_PER_TOKEN
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN

export function chunkDocuments(docs: CorpusDocument[]): Passage[] {
  const passages: Passage[] = []
  for (const doc of docs) {
    const chunks = chunkText(doc.text)
    for (const chunk of chunks) {
      passages.push({
        id: crypto.randomUUID(),
        text: chunk,
        documentId: doc.id,
        sourceName: doc.sourceName,
        sourceUrl: doc.sourceUrl,
        category: doc.category,
      })
    }
  }
  return passages
}

function chunkText(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = start + CHUNK_CHARS
    chunks.push(text.slice(start, end).trim())
    start = end - OVERLAP_CHARS
  }
  return chunks.filter((c) => c.length > 50)
}
