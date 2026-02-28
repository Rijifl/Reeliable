export interface AnalyzeReelRequest {
  reelId: string;
  creator: string;
  videoUrl: string;
  durationMs?: number;
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
