// Embed claim → Qdrant vector search → top sources
import { embed } from './embeddings.js'
import { qdrant } from './qdrant.js'
import { Claim, Source } from './types.js'

const COLLECTION = process.env.QDRANT_COLLECTION ?? 'medical_facts'
const TOP_K = 3

export async function retrieveEvidence(claim: Claim): Promise<Source[]> {
  const vector = await embed(claim.text)

  const results = await qdrant.search(COLLECTION, {
    vector,
    limit: TOP_K,
    with_payload: true,
  })

  return results.map((hit) => ({
    title: String(hit.payload?.title ?? ''),
    url: String(hit.payload?.sourceUrl ?? ''),
    excerpt: String(hit.payload?.text ?? ''),
    sourceName: String(hit.payload?.sourceName ?? ''),
  }))
}
