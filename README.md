# Reeliable

A Chrome extension that fact-checks Instagram Reels in real time using multimodal AI. It extracts video frames, transcribes audio, identifies health claims, and surfaces discrepancies — all while you scroll.

## How It Works

1. The content script detects the active Reel and reads the video URL from the `<video>` element.
2. It sends `REEL_DETECTED` (with `reelId`, `creator`, `videoUrl`, `durationMs`) to the background service worker.
3. The background calls `POST /v1/analyze-reel` on the local server.
4. The server uses `yt-dlp` to download the video, `ffmpeg` to extract up to 15 frames (every 2s), and optionally transcribes the audio via Groq Whisper. The frames + caption + transcript are sent to a vision model (any OpenAI-compatible VLM; default Google Gemini Flash) which returns:
   - `transcript[]` — timestamped speech
   - `claims[]` — notable health/factual claims with reasoning
   - `discrepancies[]` — mismatches between visuals, text, and audio
   - `claims[].verdict` *(optional)* — each claim fact-checked against the web via Gemini's Google Search grounding (supported / contradicted / partially true / unverified), with source links
5. Results are cached by `reelId` and broadcast to the content script and side panel.
6. The overlay and side panel render timestamp-synced transcripts, claim cards, and discrepancy alerts.

## Tech Stack

- **Extension**: Chrome MV3, React, TypeScript, Vite
- **Server**: Fastify, TypeScript, tsx
- **AI**: Pluggable VLM via any OpenAI-compatible API — default Google Gemini Flash (free tier), or OpenRouter / Groq / local Ollama. Groq Whisper for audio transcription (optional)
- **Media**: yt-dlp (download), ffmpeg (frame extraction + audio)
- **UI Preview**: Vite + React standalone app with mock data

## Packages

- `extension/` — MV3 extension (content script, background worker, overlay UI, side panel UI)
- `server/` — Fastify API (`/v1/analyze-reel`) + yt-dlp/ffmpeg frame extraction + pluggable VLM client
- `packages/preview/` — Standalone UI preview with mock `AnalyzeReelResponse` data

## Requirements

- Node.js 20+
- pnpm 9+
- `ffmpeg` on system `PATH` — [install guide](https://ffmpeg.org/download.html)
- `yt-dlp` on system `PATH` — [install guide](https://github.com/yt-dlp/yt-dlp#installation)
- A `VLM_API_KEY` for the vision model — required for hosted providers (a free [Google AI Studio](https://aistudio.google.com/apikey) key works), or run a local model with Ollama and no key
- A `GROQ_API_KEY` (optional — enables audio transcription)

**Install system tools (macOS):**
```bash
brew install ffmpeg yt-dlp
```

## Setup

**1. Install dependencies:**

```bash
pnpm install
```

**2. Configure environment:**

```bash
cp .env.example .env
```

Edit `.env` and fill in your keys:

```env
# Vision model — default is Google Gemini Flash's free tier
VLM_API_KEY=...                # Required for hosted providers (e.g. Google AI Studio key)
VLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
VLM_MODEL=gemini-2.5-flash
GROUNDING_API_KEY=             # Optional — web fact-checking (reuses VLM key when VLM is Gemini)
GROQ_API_KEY=gsk_...           # Optional — audio transcription via Whisper
PORT=3001
```

Swap providers (OpenRouter, Groq, or local Ollama) by changing the three `VLM_*` vars — see `.env.example`.

**3. Start the server:**

```bash
cd server && pnpm dev
```

**4. Build the extension:**

```bash
cd extension && pnpm build
```

**5. Load in Chrome:**

- Go to `chrome://extensions`
- Enable **Developer Mode** (top right)
- Click **Load unpacked** and select the `extension/dist` folder

**6. Use it:**

Open Instagram in Chrome and navigate to any Reel. The side panel will open automatically and populate with the analysis.

## UI Preview (no extension needed)

To see the UI with mock data:

```bash
cd packages/preview && pnpm dev
```

Open `http://localhost:5173` in your browser.

## API Reference

### `POST /v1/analyze-reel`

Request:

```json
{
  "reelId": "abc123",
  "creator": "@creator",
  "videoUrl": "https://instagram.com/reel/...",
  "durationMs": 28400
}
```

Response:

```json
{
  "reelId": "abc123",
  "transcript": [{ "text": "line", "timestampMs": 2000 }],
  "claims": [
    {
      "id": "claim-1",
      "text": "claim text",
      "reasoning": "why notable",
      "authorSources": ["source mention"],
      "timestampMs": 4000
    }
  ],
  "discrepancies": [
    {
      "description": "visual/text mismatch",
      "frameTimestampMs": 6000,
      "severity": "medium"
    }
  ]
}
```