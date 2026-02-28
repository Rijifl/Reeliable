// Snopes health claims
import { BaseScraper } from './base.js'
import { RawDocument, CorpusDocument } from '../types.js'

export class SnopesScraper extends BaseScraper {
  name = 'snopes'

  async fetch(): Promise<RawDocument[]> {
    // TODO: scrape Snopes health category at https://www.snopes.com/fact-check/category/medical/
    return []
  }

  parse(raw: RawDocument[]): CorpusDocument[] {
    return raw.map((r) => ({
      id: r.id,
      text: r.rawText,
      sourceName: 'Snopes',
      sourceUrl: r.metadata.url ?? 'https://www.snopes.com',
      category: 'fact-check',
    }))
  }
}
