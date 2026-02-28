export interface TranscriptSegment {
  text: string;
  start_ms: number;
  end_ms: number;
}

export interface ProcessReelRequest {
  reelId: string;
  creator: string;
  transcript: TranscriptSegment[];
}

export interface Claim {
  id: string;
  text: string;
  type: string; // treatment | statistic | mechanism | product
  entities: string[];
  timestamp_ms: number; // when in the reel this claim appears
}

export interface Source {
  title: string;
  url: string;
  excerpt: string;
  siteName: string;
}

export interface Verdict {
  claimId: string;
  status: 'supported' | 'contradicted' | 'unverified' | 'partially_true';
  summary: string;
  sources: Source[];
}

export interface CheckedClaim {
  claim: Claim;
  verdict: Verdict;
}

export interface ProcessReelResponse {
  reelId: string;
  checkedClaims: CheckedClaim[];
}
