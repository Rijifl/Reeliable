// PubMed abstracts via NCBI Entrez API
import { BaseScraper } from './base.js'
import { RawDocument, CorpusDocument } from '../types.js'

const ENTREZ_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const SEARCH_TERM = 'health[MeSH] AND english[lang]'
const MAX_RESULTS = 5000

export class PubMedScraper extends BaseScraper {
  name = 'pubmed'

  async fetch(): Promise<RawDocument[]> {
    // 1. Search for PMIDs
    const searchUrl = `${ENTREZ_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(SEARCH_TERM)}&retmax=${MAX_RESULTS}&retmode=json`
    const searchRes = await fetch(searchUrl)
    const searchData = await searchRes.json() as any
    const ids: string[] = searchData.esearchresult.idlist

    // 2. Fetch abstracts in batches of 200
    const docs: RawDocument[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200).join(',')
      const fetchUrl = `${ENTREZ_BASE}/efetch.fcgi?db=pubmed&id=${batch}&rettype=abstract&retmode=text`
      const text = await (await fetch(fetchUrl)).text()
      docs.push({ id: `pubmed-batch-${i}`, rawText: text, metadata: { source: 'pubmed' } })
      await delay(300) // respect NCBI rate limit
    }
    return docs
  }

  parse(raw: RawDocument[]): CorpusDocument[] {
    // TODO: parse PubMed abstract text format into individual documents
    return raw.map((r, i) => ({
      id: `pubmed-${i}`,
      text: r.rawText,
      sourceName: 'PubMed',
      sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov',
      category: 'general',
    }))
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
