// Batch upsert vectors + payloads into Qdrant collection "medical_facts"
import { QdrantClient } from '@qdrant/js-client-rest'
import { EmbeddedPassage } from './embedder.js'

const COLLECTION = process.env.QDRANT_COLLECTION ?? 'medical_facts'
const VECTOR_SIZE = 1536
const BATCH_SIZE = 100

const qdrant = new QdrantClient({ url: process.env.QDRANT_URL ?? 'http://localhost:6333' })

export async function ensureCollection() {
  const collections = await qdrant.getCollections()
  const exists = collections.collections.some((c) => c.name === COLLECTION)
  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    })
    await qdrant.createPayloadIndex(COLLECTION, { field_name: 'sourceName', field_schema: 'keyword' })
    await qdrant.createPayloadIndex(COLLECTION, { field_name: 'category', field_schema: 'keyword' })
  }
}

export async function uploadPassages(passages: EmbeddedPassage[]) {
  await ensureCollection()

  for (let i = 0; i < passages.length; i += BATCH_SIZE) {
    const batch = passages.slice(i, i + BATCH_SIZE)
    await qdrant.upsert(COLLECTION, {
      wait: true,
      points: batch.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: {
          text: p.text,
          documentId: p.documentId,
          sourceName: p.sourceName,
          sourceUrl: p.sourceUrl,
          category: p.category,
        },
      })),
    })
  }
}
