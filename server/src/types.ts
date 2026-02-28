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
