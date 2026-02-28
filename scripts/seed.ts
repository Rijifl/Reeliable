// Runs all scrapers → chunk → embed → upload in one command
// Usage: npx tsx scripts/seed.ts

import { PubMedScraper } from '../corpus/src/scrapers/pubmed.js'
import { WHOScraper } from '../corpus/src/scrapers/who.js'
import { CDCScraper } from '../corpus/src/scrapers/cdc.js'
import { SnopesScraper } from '../corpus/src/scrapers/snopes.js'
import { FDAScraper } from '../corpus/src/scrapers/fda.js'
import { CochraneScraper } from '../corpus/src/scrapers/cochrane.js'
import { chunkDocuments } from '../corpus/src/chunker.js'
import { embedPassages } from '../corpus/src/embedder.js'
import { uploadPassages } from '../corpus/src/uploader.js'
import { BaseScraper } from '../corpus/src/scrapers/base.js'

const scrapers: BaseScraper[] = [
  new PubMedScraper(),
  new WHOScraper(),
  new CDCScraper(),
  new SnopesScraper(),
  new FDAScraper(),
  new CochraneScraper(),
]

;(async () => {
  for (const scraper of scrapers) {
    console.log(`\n=== ${scraper.name} ===`)
    const raw = await scraper.fetch()
    const docs = scraper.parse(raw)
    const passages = chunkDocuments(docs)
    const embedded = await embedPassages(passages)
    await uploadPassages(embedded)
    console.log(`✓ ${scraper.name}: ${passages.length} passages indexed`)
  }
  console.log('\nDone. Corpus ready.')
})()
