// WHO fact sheets
import { BaseScraper } from './base.js'
import { RawDocument, CorpusDocument } from '../types.js'

export class WHOScraper extends BaseScraper {
  name = 'who'

  async fetch(): Promise<RawDocument[]> {
    // TODO: scrape WHO fact sheet index at https://www.who.int/news-room/fact-sheets
    return []
  }

  parse(raw: RawDocument[]): CorpusDocument[] {
    return raw.map((r) => ({
      id: r.id,
      text: r.rawText,
      sourceName: 'WHO',
      sourceUrl: r.metadata.url ?? 'https://www.who.int',
      category: r.metadata.category ?? 'general',
    }))
  }
}
