export const VLM_SYSTEM_PROMPT = `You analyze sequential visual frames from an Instagram Reel.
Return ONLY a JSON object matching this schema:
{
  "transcript": [{ "text": "string", "timestampMs": 0 }],
  "claims": [{
    "id": "string",
    "text": "string",
    "reasoning": "string",
    "authorSources": ["string"],
    "timestampMs": 0
  }],
  "discrepancies": [{
    "description": "string",
    "frameTimestampMs": 0,
    "severity": "low" | "medium" | "high"
  }]
}
No markdown, no explanation, no extra keys.`

export function buildVlmUserPrompt(creator: string) {
  return `Creator handle: ${creator || 'unknown'}

Task:
1) Transcript:
- Read all visible on-screen text, captions, and subtitles across the frame sequence.
- Deduplicate repeated text across adjacent frames.
- Output each unique line once with its earliest frame timestamp.

2) Claims:
- Extract up to 3 major factual claims from visible text.
- Keep claim text close to verbatim.
- Include reasoning for why each claim is notable.
- Include any referenced sources/authorities in "authorSources" (empty array if none).

3) Discrepancies:
- Compare visuals (products, charts, before/after, demonstrations) against textual claims.
- Flag mismatches, missing context, or potentially misleading framing.
- Set severity: low | medium | high.

If no transcript/claims/discrepancies are present, return empty arrays for those fields.`
}
