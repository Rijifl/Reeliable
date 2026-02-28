# ReelCheck

Real-time medical claim fact-checking for Instagram Reels. A Chrome extension that transcribes the full audio of a reel with timestamps, extracts health claims, searches the live web via Firecrawl, and overlays verdict cards at the exact moment each claim is made — with prefetching so the next reel's verdicts are ready before the user scrolls to it.

---

## How It Works

```
Current reel:
1. Reel loads → tab audio captured → streamed to Deepgram WebSocket
2. Deepgram returns final transcript segments with timestamps
3. Full transcript sent to POST /v1/process-reel
4. Server:
   a. Haiku extracts all claims with timestamps from the full transcript
   b. For each claim: Firecrawl searches the web → scrapes top results
   c. Haiku writes a grounded verdict from the scraped content
   d. Returns { checkedClaims: [{ claim, verdict }] } sorted by timestamp
5. Overlay shows verdict cards as video playback reaches each claim's timestamp

Next reel (prefetch):
1. While user watches reel N, extension detects reel N+1 in the DOM
2. Starts audio capture + transcription for reel N+1 in the background
3. Sends transcript to backend to process N+1 silently
4. Results cached server-side by reelId
5. When user scrolls to reel N+1 → instant cache hit → verdicts shown immediately
```

---

## Packages

```
extension/    Chrome Extension (Manifest V3) — capture, transcribe, prefetch, overlay
server/       Fastify API — transcript → claims → Firecrawl → verdicts
packages/web/ Architecture diagram viewer
```

---

## Running the Project

### Prerequisites

- Node.js 20+
- pnpm 9+

### Step 1 — Install dependencies

```bash
pnpm install
```

### Step 2 — Set environment variables

```bash
cp .env.example .env
```

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `DEEPGRAM_API_KEY` | [console.deepgram.com](https://console.deepgram.com) |
| `FIRECRAWL_API_KEY` | [firecrawl.dev](https://firecrawl.dev) |

### Step 3 — Start the server

```bash
cd server && pnpm dev
# Listening on http://localhost:3001
```

To test manually:

```bash
curl -X POST http://localhost:3001/v1/process-reel \
  -H "Content-Type: application/json" \
  -d '{
    "reelId": "test123",
    "creator": "@healthguru",
    "transcript": [
      { "text": "Studies show vitamin D cures cancer.", "start_ms": 4200, "end_ms": 6800 },
      { "text": "Taking 10000 IU daily is completely safe.", "start_ms": 7100, "end_ms": 9500 }
    ]
  }'
```

### Step 4 — Build and load the extension

```bash
cd extension && pnpm build
```

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select `extension/dist/`

For development with auto-rebuild:

```bash
cd extension && pnpm dev
```

After each rebuild, click the refresh icon on the extension card then reload the Instagram tab.

### Step 5 — Use it

1. Open any Instagram Reel
2. As the reel plays, Deepgram transcribes the audio
3. When the transcript is complete, it's processed against the live web via Firecrawl
4. Verdict cards appear on screen at the timestamp of each claim
5. Scroll to the next reel — if prefetching completed, verdicts are instant

---

## API

### `POST /v1/process-reel`

Accepts a full timestamped transcript, returns all fact-checked claims.

**Request**
```json
{
  "reelId": "abc123",
  "creator": "@healthguru",
  "transcript": [
    { "text": "Vitamin D cures cancer.", "start_ms": 4200, "end_ms": 5800 }
  ]
}
```

**Response**
```json
{
  "reelId": "abc123",
  "checkedClaims": [
    {
      "claim": {
        "id": "c1",
        "text": "vitamin D cures cancer",
        "type": "treatment",
        "entities": ["vitamin D", "cancer"],
        "timestamp_ms": 4200
      },
      "verdict": {
        "claimId": "c1",
        "status": "contradicted",
        "summary": "No clinical trials support this. Some research suggests a preventive role, but vitamin D is not an established cancer treatment.",
        "sources": [
          { "title": "Vitamin D and Cancer", "url": "...", "excerpt": "...", "siteName": "cancer.gov" }
        ]
      }
    }
  ]
}
```

### `GET /v1/reel/:reelId`

Returns cached results for a reel, or `404 { cached: false }` if not yet processed.

---

## Tech Stack

| Layer | Stack |
|---|---|
| Chrome Extension | Manifest V3, React (Shadow DOM overlay), Web Audio API, Deepgram WebSocket |
| Backend | Fastify, Anthropic SDK (claude-haiku-4-5), in-memory reel cache |
| Fact-checking | Firecrawl search + scrape (live web, no corpus needed) |
| Transcription | Deepgram nova-2-medical, word-level timestamps |

---

## Environment Variables

```env
ANTHROPIC_API_KEY=     # Claim extraction + verdict synthesis
DEEPGRAM_API_KEY=      # Streaming audio transcription
FIRECRAWL_API_KEY=     # Web search + scraping
PORT=                  # Default: 3001
```

---

## Development Scripts

| Command | What it does |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `cd server && pnpm dev` | Start API server with hot reload |
| `cd extension && pnpm dev` | Build extension in watch mode |
| `cd extension && pnpm build` | Production build of extension |

---

## MVP Scope

| Feature | Status |
|---|---|
| Full reel audio transcription via Deepgram | ✅ |
| Timestamped transcript → claim extraction via Haiku | ✅ |
| Live web fact-checking via Firecrawl | ✅ |
| Verdict cards timed to video playback | ✅ |
| Prefetch next reel before user scrolls | ✅ |
| Server-side reel result cache | ✅ |
| On/off toggle | ✅ |
| Redis persistent cache | ❌ Later |
| Cross-encoder reranking of Firecrawl results | ❌ Later |
| OCR / VLM visual analysis | ❌ Later |
| User feedback system | ❌ Later |
