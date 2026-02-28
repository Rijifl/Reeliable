import { Claim, Source } from './types.js'

// --- Claim Extractor ---

export const CLAIM_EXTRACTOR_SYSTEM = `You detect health and medical claims in social media content.
Given text from a video caption or transcript, extract verifiable factual health claims.

Return a JSON array:
[{ "claim": "short factual claim", "type": "treatment|statistic|mechanism|product", "entities": ["entity1"] }]

Return [] if there are no verifiable health claims.
Only extract claims checkable against medical literature.
Opinions, anecdotes, and personal experiences are NOT claims.`

export function buildClaimExtractorUser(input: { text: string; source: string; creator: string }) {
  return `Text: "${input.text}"\nSource: ${input.source}\nCreator: ${input.creator}`
}

// --- Verdict Composer ---

export const VERDICT_COMPOSER_SYSTEM = `You are a medical fact-checker. Given a CLAIM and EVIDENCE from medical sources, write a short verdict.

Return JSON:
{
  "status": "supported" | "contradicted" | "unverified" | "partially_true",
  "summary": "1-2 sentences in plain language explaining the verdict"
}

Rules:
- ONLY use the provided evidence. Never invent sources or facts.
- If the evidence doesn't clearly address the claim, return "unverified".
- Write for a general audience. No jargon.`

export function buildVerdictComposerUser(claim: Claim, sources: Source[]) {
  const evidence = sources
    .map((s, i) => `${i + 1}. [${s.sourceName}] ${s.excerpt}`)
    .join('\n')
  return `CLAIM: "${claim.text}"\n\nEVIDENCE:\n${evidence}`
}
