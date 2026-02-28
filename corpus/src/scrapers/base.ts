import { RawDocument, CorpusDocument } from '../types.js'

export abstract class BaseScraper {
  abstract name: string
  abstract fetch(): Promise<RawDocument[]>
  abstract parse(raw: RawDocument[]): CorpusDocument[]
}
