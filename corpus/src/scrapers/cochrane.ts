// Cochrane systematic review plain-language summaries
import { BaseScraper } from './base.js'
import { RawDocument, CorpusDocument } from '../types.js'

export class CochraneScraper extends BaseScraper {
  name = 'cochrane'

  async fetch(): Promise<RawDocument[]> {
    // TODO: scrape Cochrane Library plain-language summaries at https://www.cochranelibrary.com
    return []
  }

  parse(raw: RawDocument[]): CorpusDocument[] {
    return raw.map((r) => ({
      id: r.id,
      text: r.rawText,
      sourceName: 'Cochrane',
      sourceUrl: r.metadata.url ?? 'https://www.cochranelibrary.com',
      category: 'systematic-review',
    }))
  }
}
