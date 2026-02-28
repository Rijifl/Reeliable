# ReelCheck

Real-time medical claim fact-checking for Instagram Reels. A Chrome extension that reads captions and transcribes audio as a reel plays, checks health claims against a fact-check corpus, and overlays verdict cards directly on the video.

---

## How It Works

```
1. User opens an Instagram Reel
2. Content script detects reel → extracts caption text immediately (0ms)
3. Simultaneously: tab audio captured → streamed to Deepgram → partial transcripts arrive every ~300-500ms
4. Caption text and finalized ASR sentences are both sent to POST /v1/check
5. Server pipeline:
   a. Haiku extracts verifiable health claims (or returns "no claims")
   b. For each claim: embed → Qdrant vector search → top 3 sources
   c. Haiku writes a grounded verdict using only retrieved sources
   d. Results stream back via SSE
6. Overlay renders a verdict card on the reel
```

Captions fire instantly. ASR catches anything spoken but not written. Both feed the same endpoint.

---

## Packages

```
extension/      Chrome Extension (Manifest V3)
server/         Fastify API — SSE endpoint + LLM pipeline
corpus/         Scraping + indexing pipeline for the fact-check corpus
scripts/        Seed script to run the full corpus pipeline in one command
packages/web/   Standalone viewer for system.tsx architecture diagram
```

---

## Running the Project

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for Qdrant)

### Step 1 — Install dependencies

```bash
pnpm install
```

### Step 2 — Set environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) |
| `DEEPGRAM_API_KEY` | [console.deepgram.com](https://console.deepgram.com) |

`QDRANT_URL`, `QDRANT_COLLECTION`, and `PORT` have defaults and can be left as-is for local development.

### Step 3 — Start Qdrant

```bash
docker run -p 6333:6333 qdrant/qdrant
```

Leave this running in its own terminal. Qdrant stores the vector database at `http://localhost:6333`.

### Step 4 — Index the corpus

Run all 6 scrapers in sequence — scrape → chunk → embed → upload to Qdrant:

```bash
cd corpus && npx tsx src/index.ts --all
```

To run a single scraper instead:

```bash
npx tsx src/index.ts pubmed
npx tsx src/index.ts who
npx tsx src/index.ts cdc
npx tsx src/index.ts snopes
npx tsx src/index.ts fda
npx tsx src/index.ts cochrane
```

This only needs to run once. Re-run it whenever you want to refresh the corpus.

### Step 5 — Start the server

```bash
cd server && pnpm dev
```

The API will be listening at `http://localhost:3001`. The `dev` script uses `tsx watch` so the server hot-reloads on file changes.

To test the endpoint manually:

```bash
curl -N -X POST http://localhost:3001/v1/check \
  -H "Content-Type: application/json" \
  -d '{"reelId":"test","text":"Vitamin D cures cancer","source":"caption","creator":"@test"}'
```

You should see SSE events stream back in the terminal.

### Step 6 — Build and load the extension

```bash
cd extension && pnpm build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer Mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension/dist/` folder

For active development, use watch mode so the extension rebuilds on every save:

```bash
cd extension && pnpm dev
```

After each rebuild, click the refresh icon on the extension card in `chrome://extensions` to pick up the changes, then reload the Instagram tab.

### Step 7 — Use it

1. Open any Instagram Reel at `instagram.com`
2. The extension icon should show as active
3. If the reel caption or audio contains a health claim, a verdict card will appear over the video within ~200ms–1.2s

Use the extension popup to toggle fact-checking on/off per-tab.

---

## Development Scripts

| Command | What it does |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `cd server && pnpm dev` | Start API server with hot reload |
| `cd extension && pnpm dev` | Build extension in watch mode |
| `cd extension && pnpm build` | Production build of extension |
| `cd corpus && npx tsx src/index.ts --all` | Run all scrapers and index to Qdrant |
| `cd corpus && npx tsx src/index.ts <name>` | Run a single scraper by name |
| `npx tsx scripts/seed.ts` | Same as `--all` from the root |

---

## Corpus Sources

| Source | What | Volume |
|---|---|---|
| PubMed / MEDLINE | Biomedical abstracts via NCBI Entrez API | ~5K abstracts |
| WHO | Fact sheets and disease pages | ~400 documents |
| CDC | Health topics and MMWR highlights | ~500 documents |
| Snopes | Pre-checked health claims | ~2K claims |
| FDA | Drug safety alerts and consumer updates | ~300 documents |
| Cochrane | Systematic review plain-language summaries | ~1K summaries |

Collection: `medical_facts` · Vector size: 1536 (text-embedding-3-small) · Distance: Cosine

---

## API

### `POST /v1/check`

**Request**
```json
{
  "reelId": "abc123",
  "text": "Studies prove vitamin D cures cancer",
  "source": "caption",
  "creator": "@healthguru"
}
```

**Response** — SSE stream (`text/event-stream`)
```
data: {"type":"claim_detected","claim":{"id":"c1","text":"vitamin D cures cancer","type":"treatment","entities":["vitamin D","cancer"]}}

data: {"type":"verdict","verdict":{"claimId":"c1","status":"contradicted","summary":"No clinical trials support this. Some research suggests a preventive role, but vitamin D is not an established cancer treatment.","sources":[...]}}
```

Verdict statuses: `supported` · `contradicted` · `partially_true` · `unverified`

---

## Tech Stack

| Layer | Stack |
|---|---|
| Chrome Extension | Manifest V3, React (Shadow DOM overlay), Web Audio API, Deepgram WebSocket |
| Backend | Fastify, Anthropic SDK (claude-haiku-4-5), SSE streaming |
| Retrieval | Qdrant, OpenAI text-embedding-3-small |
| Corpus Pipeline | Node.js scrapers, NCBI Entrez API, Cheerio |
| Infrastructure | Docker (Qdrant), any Node host (Fly.io, Railway) |

---

## Environment Variables

```env
ANTHROPIC_API_KEY=     # Claim extraction + verdict synthesis
OPENAI_API_KEY=        # Embeddings only
DEEPGRAM_API_KEY=      # Streaming audio transcription
QDRANT_URL=            # Default: http://localhost:6333
QDRANT_COLLECTION=     # Default: medical_facts
PORT=                  # Default: 3001
```

---

## MVP Scope

| Feature | Status |
|---|---|
| Read reel captions from DOM | ✅ |
| Stream audio → Deepgram ASR | ✅ |
| Extract claims via Haiku | ✅ |
| Search corpus via Qdrant | ✅ |
| Generate verdict via Haiku | ✅ |
| Stream results via SSE | ✅ |
| Overlay verdict card on reel | ✅ |
| On/off toggle | ✅ |
| Corpus scrapers (6 sources) | ✅ |
| Chunking + embedding pipeline | ✅ |
| Redis caching | ❌ Later |
| Cross-encoder reranking | ❌ Later |
| OCR / VLM visual analysis | ❌ Later |
| User feedback system | ❌ Later |
| Scheduled corpus updates | ❌ Later |
