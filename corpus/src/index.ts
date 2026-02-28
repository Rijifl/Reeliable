// CLI entry — run one or all scrapers
import { PubMedScraper } from './scrapers/pubmed.js'
import { WHOScraper } from './scrapers/who.js'
import { CDCScraper } from './scrapers/cdc.js'
import { SnopesScraper } from './scrapers/snopes.js'
import { FDAScraper } from './scrapers/fda.js'
import { CochraneScraper } from './scrapers/cochrane.js'
import { chunkDocuments } from './chunker.js'
import { embedPassages } from './embedder.js'
import { uploadPassages } from './uploader.js'
import { BaseScraper } from './scrapers/base.js'

const scrapers: BaseScraper[] = [
  new PubMedScraper(),
  new WHOScraper(),
  new CDCScraper(),
  new SnopesScraper(),
  new FDAScraper(),
  new CochraneScraper(),
]

const args = process.argv.slice(2)
const runAll = args.includes('--all')
const targetName = args.find((a) => !a.startsWith('--'))

async function run(scraper: BaseScraper) {
  console.log(`[${scraper.name}] Fetching...`)
  const raw = await scraper.fetch()
  const docs = scraper.parse(raw)
  console.log(`[${scraper.name}] Parsed ${docs.length} documents`)

  const passages = chunkDocuments(docs)
  console.log(`[${scraper.name}] ${passages.length} passages after chunking`)

  const embedded = await embedPassages(passages)
  await uploadPassages(embedded)
  console.log(`[${scraper.name}] Done`)
}

;(async () => {
  const targets = runAll
    ? scrapers
    : scrapers.filter((s) => s.name.toLowerCase() === targetName?.toLowerCase())

  if (targets.length === 0) {
    console.error('No scrapers matched. Use --all or specify a scraper name.')
    process.exit(1)
  }

  for (const scraper of targets) {
    await run(scraper)
  }
})()
