# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ReelCheck** — a Chrome extension that fact-checks health claims in Instagram Reels in real time. Captions are extracted immediately from the DOM; audio is captured and streamed to Deepgram for ASR. Both feed a Fastify SSE endpoint that runs a 3-stage LLM pipeline (claim extraction → vector retrieval → verdict synthesis) and streams results back to a side panel overlay.

## Monorepo Structure

pnpm workspace with these packages:

- `extension/` — Chrome MV3 extension (Vite + React)
- `server/` — Fastify API server (SSE endpoint + LLM pipeline)
- `corpus/` — Scraping + embedding pipeline (populates Qdrant)
- `scripts/` — Root-level seed script (`seed.ts`)

## Commands

```bash
# Install all workspace deps
pnpm install

# Server (hot-reload via tsx watch)
cd server && pnpm dev

# Extension — watch mode (rebuild on save, then manually refresh in chrome://extensions)
cd extension && pnpm dev

# Extension — production build
cd extension && pnpm build

# Index full corpus (scrape → chunk → embed → upload to Qdrant)
cd corpus && npx tsx src/index.ts --all

# Index a single corpus source
cd corpus && npx tsx src/index.ts pubmed   # or: who, cdc, snopes, fda, cochrane

# Seed from root
npx tsx scripts/seed.ts

# Test the SSE endpoint manually
curl -N -X POST http://localhost:3001/v1/check \
  -H "Content-Type: application/json" \
  -d '{"reelId":"test","text":"Vitamin D cures cancer","source":"caption","creator":"@test"}'
```

## Infrastructure

- **Qdrant** (Docker): `docker run -p 6333:6333 qdrant/qdrant` — must be running before corpus indexing or server use
- **Server**: `http://localhost:3001`
- **Qdrant UI**: `http://localhost:6333`
- Collection: `medical_facts` · 1536-dim vectors (OpenAI `text-embedding-3-small`) · Cosine distance

## Server Pipeline (`server/src/`)

`POST /v1/check` is a single SSE endpoint in `check.ts` that chains three stages:

1. `claim-extractor.ts` — calls Claude Haiku to extract verifiable health claims from input text; returns `[]` if none found (triggers `no_claims` SSE event)
2. `retriever.ts` → `embeddings.ts` + `qdrant.ts` — embeds each claim, vector-searches Qdrant for top-3 evidence passages
3. `verdict-composer.ts` — calls Haiku again with retrieved evidence to produce a grounded verdict (`supported` | `contradicted` | `partially_true` | `unverified`)

LLM prompts live in `prompts.ts`. Anthropic client in `anthropic.ts`, OpenAI client (embeddings only) in `embeddings.ts`.

## Extension Architecture (`extension/src/`)

Five entry points built by Vite (each becomes its own JS bundle):

| File | Role |
|---|---|
| `content.ts` | Injected into Instagram tabs; detects reel changes via MutationObserver, triggers audio capture and API calls |
| `background.ts` | Service worker; opens side panel on Instagram, manages the offscreen document lifecycle, relays messages between components |
| `offscreen.ts` | Runs in offscreen document; captures tab audio via Web Audio API, streams to Deepgram WebSocket |
| `panel.tsx` | React side panel UI; renders verdict cards |
| `popup.ts` | Extension popup; on/off toggle |

Message flow: `content` ↔ `background` ↔ `offscreen` via `chrome.runtime.sendMessage`. The background service worker also forwards `ASR_SEGMENT` / `TRANSCRIPT_DONE` events back to the content script.

`api.ts` — makes the actual `POST /v1/check` fetch and parses the SSE stream.
`prefetch.ts` — caches check results for the next reel to reduce latency.
`deepgram.ts` — Deepgram WebSocket client used by `offscreen.ts`.

## Corpus Pipeline (`corpus/src/`)

Each scraper extends `BaseScraper` (in `scrapers/base.ts`) with `fetch()` and `parse()` methods. The `index.ts` CLI orchestrates: scrape → `chunker.ts` → `embedder.ts` → `uploader.ts` (to Qdrant).

## Environment Variables

Copy `.env.example` to `.env`:

```
ANTHROPIC_API_KEY=   # Claim extraction + verdict synthesis (claude-haiku-4-5)
OPENAI_API_KEY=      # Embeddings only (text-embedding-3-small)
DEEPGRAM_API_KEY=    # Streaming ASR
QDRANT_URL=          # Default: http://localhost:6333
QDRANT_COLLECTION=   # Default: medical_facts
PORT=                # Default: 3001
```

## Known TODOs in Content Script

`content.ts` has three stub functions that need Instagram DOM implementation: `detectActiveReel()`, `detectNextReel()`, and `extractCreator()` — all currently return `null`/`''`.
