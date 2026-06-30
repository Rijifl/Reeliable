# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Reeliable** — a Chrome extension that fact-checks Instagram Reels in real time using a vision-language model. The content script captures frames directly from the playing `<video>` in the authenticated tab (via an off-screen canvas) and sends them to the local server — so **no Instagram cookies or server-side download are needed** for video reels. The server runs the frames (+ caption) through a VLM, which returns a timestamped on-screen-text transcript, notable claims, and visual/textual discrepancies; each claim is optionally web-grounded into a verdict. Results render in an in-page overlay and a side panel. (If the canvas is cross-origin-tainted, the server falls back to downloading the reel with yt-dlp + ffmpeg.)

## Monorepo Structure

pnpm workspace with these packages:

- `extension/` — Chrome MV3 extension (Vite + React)
- `server/` — Fastify API server (`POST /v1/analyze-reel` + VLM pipeline)
- `packages/preview/` — Standalone Vite + React app that renders the UI against mock data (no extension/server needed)

## Commands

```bash
# Install all workspace deps
pnpm install

# Server (hot-reload via tsx watch)
cd server && pnpm dev

# Server (production build → dist/, then run)
cd server && pnpm build && pnpm start

# Extension — watch mode (rebuild on save, then refresh in chrome://extensions)
cd extension && pnpm dev

# Extension — production build (load extension/dist as an unpacked extension)
cd extension && pnpm build

# UI preview with mock data
cd packages/preview && pnpm dev

# Test the endpoint manually
curl -X POST http://localhost:3001/v1/analyze-reel \
  -H "Content-Type: application/json" \
  -d '{"reelId":"test","creator":"@test","videoUrl":"https://www.instagram.com/reels/DVREZnVILGz/"}'
```

## Infrastructure

- **Server**: `http://localhost:3001`
- `yt-dlp` and `ffmpeg` must be on `PATH` (the server shells out to both). The Docker image installs them.
- No database. Results are cached in-memory by `reelId` (bounded LRU) for the server process lifetime.

## Server Pipeline (`server/src/`)

`POST /v1/analyze-reel` (`analyze-reel.ts`) runs a single pipeline (`video-analyzer.ts`):

1. **Frame acquisition** — the **primary** path uses frames captured in the browser and sent in `request.frames` (no download). If `frames` is empty, `video-processor.ts` falls back: `yt-dlp` downloads the reel and `ffmpeg` extracts up to 15 frames (1 every 2s, capped); for image posts the extension passes CDN `imageUrls`, which the server fetches directly. On the fallback path only, audio is extracted with ffmpeg and transcribed via Groq Whisper (`transcription.ts`) when `GROQ_API_KEY` is set.
2. `vlm.ts` — sends frames + caption + transcript to an **OpenAI-compatible `/chat/completions` vision endpoint** and parses the JSON response into `{ transcript, claims, discrepancies }`. Output is sanitized and capped. Invalid/non-JSON model output degrades to an empty result rather than erroring.
3. `grounding.ts` — *(optional)* fact-checks each extracted claim against the web via Gemini's Google Search grounding, attaching a `verdict` (supported / contradicted / partially_true / unverified, with source links). Runs only when a Gemini key is available (reuses `VLM_API_KEY` when the VLM is Gemini); failures degrade per-claim.

The VLM provider is configured entirely by env (`VLM_BASE_URL` / `VLM_API_KEY` / `VLM_MODEL`), so it works with Gemini (default), OpenRouter, Groq, or a local Ollama model with no code change. Prompts live in `vlm-prompts.ts`. `ValidationError` (`errors.ts`) maps to HTTP 400; anything else is a 500.

## Extension Architecture (`extension/src/`)

Entry points built by Vite (each becomes its own bundle):

| File | Role |
|---|---|
| `reel-extractor-main.ts` | **MAIN world** script; walks the React fiber tree (`reel-id-extractor.ts`) to read each reel's shortcode, then `window.postMessage`s a `REEL_IDENTITY` to the content script |
| `content.tsx` | **Isolated world** content script; finds the most-visible reel, **captures frames from the `<video>` via canvas**, builds the analyze request, manages the in-page overlay, and forwards `REEL_DETECTED` to the background |
| `background.ts` | Service worker; opens the side panel, calls the server (`api.ts`), caches results (bounded LRU) with `AbortController` cancellation, and relays `ANALYSIS_*` messages |
| `overlay.tsx` | In-page overlay UI; reuses the shared `ui.tsx` components in a shadow root, anchored to the reel |
| `panel.tsx` | React side-panel UI; reuses the shared `ui.tsx` components to render transcript / claims / discrepancies / verdicts |
| `ui.tsx` | Shared React components + theme used by both the overlay and the side panel |

Message flow: `reel-extractor-main` → (postMessage) → `content` → (`chrome.runtime.sendMessage`) → `background` → server. The background forwards `ANALYSIS_STARTED` / `ANALYSIS_COMPLETE` / `ANALYSIS_ERROR` back to both the content script (overlay) and the side panel.

`AnalyzeReelRequest` / `AnalyzeReelResponse` are defined in both `extension/src/types.ts` and `server/src/types.ts` (kept in sync manually).

## Environment Variables

Copy `.env.example` to `.env`:

```
VLM_API_KEY=         # Vision model key (default provider: Google Gemini Flash — free tier)
VLM_BASE_URL=        # Default: https://generativelanguage.googleapis.com/v1beta/openai
VLM_MODEL=           # Default: gemini-2.5-flash
GROUNDING_API_KEY=   # Optional — web fact-checking via Gemini Google Search (reuses VLM key when VLM is Gemini)
GROUNDING_MODEL=     # Default: gemini-2.5-flash
GROQ_API_KEY=        # Optional — audio transcription via Groq Whisper
YTDLP_COOKIES_FILE=          # Optional — Netscape cookie file for auth-gated reels
YTDLP_COOKIES_FROM_BROWSER=  # Optional — read a local browser profile (local dev only)
PORT=                # Default: 3001
```

Swap VLM provider by changing the three `VLM_*` vars (see `.env.example` for OpenRouter / Groq / Ollama examples).
