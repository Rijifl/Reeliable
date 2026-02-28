export interface CheckRequest {
  reelId: string;
  text: string;
  source: 'caption' | 'asr';
  creator: string;
}

export interface Claim {
  id: string;
  text: string;
  type: string; // treatment | statistic | mechanism | product
  entities: string[];
}

export interface Source {
  title: string;
  url: string;
  excerpt: string;
  sourceName: string; // "WHO", "Cochrane", "FDA"
}

export interface Verdict {
  claimId: string;
  status: 'supported' | 'contradicted' | 'unverified' | 'partially_true';
  summary: string;
  sources: Source[];
}

export type SSEEvent =
  | { type: 'claim_detected'; claim: Claim }
  | { type: 'verdict'; verdict: Verdict }
  | { type: 'no_claims' }
  | { type: 'error'; message: string };
