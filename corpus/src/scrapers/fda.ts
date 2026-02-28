// FDA drug safety alerts and consumer updates
import { BaseScraper } from './base.js'
import { RawDocument, CorpusDocument } from '../types.js'

export class FDAScraper extends BaseScraper {
  name = 'fda'

  async fetch(): Promise<RawDocument[]> {
    // TODO: scrape FDA consumer updates at https://www.fda.gov/consumers/consumer-updates
    return []
  }

  parse(raw: RawDocument[]): CorpusDocument[] {
    return raw.map((r) => ({
      id: r.id,
      text: r.rawText,
      sourceName: 'FDA',
      sourceUrl: r.metadata.url ?? 'https://www.fda.gov',
      category: r.metadata.category ?? 'drug-safety',
    }))
  }
}
