// Client-side mirror of the server's HTTP contract (server/src/types.ts is the
// source of truth). Also consumed by packages/preview via the @ext alias.
// The ChromeMessage types below are extension-internal (not part of the API).
export interface AnalyzeReelRequest {
  reelId: string;
  creator: string;
  videoUrl: string;
  durationMs?: number;
  caption?: string;
  imageUrls?: string[];
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

export interface ReelDetectedMessage {
  type: 'REEL_DETECTED';
  request: AnalyzeReelRequest;
}

export interface ReelPrefetchMessage {
  type: 'REEL_PREFETCH';
  request: AnalyzeReelRequest;
}

export interface ReelChangedMessage {
  type: 'REEL_CHANGED';
  reelId: string;
}

export interface VideoTimeMessage {
  type: 'VIDEO_TIME';
  currentMs: number;
}

export interface AnalysisStartedMessage {
  type: 'ANALYSIS_STARTED';
  reelId: string;
  creator: string;
}

export interface AnalysisCompleteMessage {
  type: 'ANALYSIS_COMPLETE';
  reelId: string;
  creator: string;
  result: AnalyzeReelResponse;
}

export interface AnalysisErrorMessage {
  type: 'ANALYSIS_ERROR';
  reelId: string;
  message: string;
}

export interface SetEnabledMessage {
  type: 'SET_ENABLED';
  enabled: boolean;
}

export type ChromeMessage =
  | ReelDetectedMessage
  | ReelPrefetchMessage
  | ReelChangedMessage
  | VideoTimeMessage
  | AnalysisStartedMessage
  | AnalysisCompleteMessage
  | AnalysisErrorMessage
  | SetEnabledMessage
