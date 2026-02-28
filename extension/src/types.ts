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

export interface ReelDetectedMessage {
  type: 'REEL_DETECTED';
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
  | ReelChangedMessage
  | VideoTimeMessage
  | AnalysisStartedMessage
  | AnalysisCompleteMessage
  | AnalysisErrorMessage
  | SetEnabledMessage
