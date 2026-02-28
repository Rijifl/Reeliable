# ReelCheck VLM

Chrome extension + Fastify server for Instagram Reel analysis using Qwen 3 VL through OpenRouter.

## Flow

1. Content script detects the active Reel and reads the video CDN URL from the `<video>` element.
2. Content script sends `REEL_DETECTED` with `{ reelId, creator, videoUrl, durationMs }` to the background service worker.
3. Background calls `POST /v1/analyze-reel`.
4. Server runs `ffmpeg` against the URL, extracts up to 15 frames (every 2s), sends frames to OpenRouter (`qwen/qwen3-vl-8b-thinking`), and returns:
   - `transcript[]`
   - `claims[]`
   - `discrepancies[]`
5. Background caches results by `reelId` and broadcasts `ANALYSIS_COMPLETE` to content + side panel.
6. Overlay and side panel render timestamp-synced transcript, discrepancy alerts, and claim cards.

## Packages

- `extension/`: MV3 extension (content script, background worker, overlay UI, side panel UI)
- `server/`: Fastify API (`/v1/analyze-reel`) + ffmpeg frame extraction + OpenRouter client
- `packages/preview/`: UI preview app with mock `AnalyzeReelResponse` data

## Requirements

- Node.js 20+
- pnpm 9+
- `ffmpeg` available on system `PATH`
- `OPENROUTER_API_KEY`

## Setup

1. Install deps:

```bash
pnpm install
```

2. Configure env:

```bash
cp .env.example .env
```

Set:

```env
OPENROUTER_API_KEY=...
PORT=3001
```

3. Start server:

```bash
cd server && pnpm dev
```

4. Build extension:

```bash
cd extension && pnpm build
```

5. Load `extension/dist` in `chrome://extensions` (Developer Mode -> Load unpacked).

## API

### `POST /v1/analyze-reel`

Request:

```json
{
  "reelId": "abc123",
  "creator": "@creator",
  "videoUrl": "https://instagram.cdn/...mp4",
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

### `GET /v1/reel/:reelId`

Returns cached analysis if available, otherwise 404.
