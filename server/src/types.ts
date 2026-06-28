// Canonical HTTP contract for POST /v1/analyze-reel. The extension mirrors these
// shapes in extension/src/types.ts — kept as a standalone copy on purpose so the
// server stays independently deployable (no workspace coupling in the Docker image).
export interface AnalyzeReelRequest {
  reelId: string;
  creator: string;
  videoUrl: string;
  durationMs?: number;
  caption?: string;      // Post caption extracted from the page
  imageUrls?: string[];  // Direct CDN image URLs for image-only posts
}

export interface TranscriptEntry {
  text: string;
  timestampMs: number;
}

export interface ExtractedClaim {
  id: string;
  text: string;
  reasoning: string;
  authorSources: string[];
  timestampMs: number;
  verdict?: Verdict;   // populated by the web-search grounding stage (optional)
}

export interface VerdictSource {
  title: string;
  url: string;
}

export interface Verdict {
  status: 'supported' | 'contradicted' | 'partially_true' | 'unverified';
  summary: string;
  sources: VerdictSource[];
}

export interface Discrepancy {
  description: string;
  frameTimestampMs: number;
  severity: 'low' | 'medium' | 'high';
}

export interface AnalyzeReelResponse {
  reelId: string;
  transcript: TranscriptEntry[];
  claims: ExtractedClaim[];
  discrepancies: Discrepancy[];
}
