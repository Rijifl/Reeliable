// CDC publications
import { BaseScraper } from './base.js'
import { RawDocument, CorpusDocument } from '../types.js'

export class CDCScraper extends BaseScraper {
  name = 'cdc'

  async fetch(): Promise<RawDocument[]> {
    // TODO: scrape CDC A-Z health topics index at https://www.cdc.gov/az/index.html
    return []
  }

  parse(raw: RawDocument[]): CorpusDocument[] {
    return raw.map((r) => ({
      id: r.id,
      text: r.rawText,
      sourceName: 'CDC',
      sourceUrl: r.metadata.url ?? 'https://www.cdc.gov',
      category: r.metadata.category ?? 'general',
    }))
  }
}
