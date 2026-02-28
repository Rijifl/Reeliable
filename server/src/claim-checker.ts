import Anthropic from '@anthropic-ai/sdk'
import { getAnthropic } from './anthropic.js'
import { Claim, Verdict } from './types.js'

export async function checkClaim(claim: Claim): Promise<Verdict> {
  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
      } as any,
    ],
    messages: [
      {
        role: 'user',
        content: `You are a health and fitness fact-checker.

Fact-check this claim from a social media video: "${claim.text}"

Search for evidence from reputable sources (medical journals, health organizations, systematic reviews). Then return ONLY a JSON object:

{
  "status": "supported" | "contradicted" | "unverified" | "partially_true",
  "summary": "1-2 sentences, plain language, no jargon",
  "sources": [
    {
      "title": "source title",
      "url": "actual URL you found",
      "siteName": "e.g. PubMed, Mayo Clinic",
      "excerpt": "key finding from this source"
    }
  ]
}`,
      },
    ],
  })

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as Anthropic.TextBlock).text)
    .join('')

  console.log(`\n── Sonnet verdict for: "${claim.text}" ──`)
  console.log(text)
  console.log('────────────────────────────────────────────\n')

  const clean = text.replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(clean)
    return {
      claimId: claim.id,
      status: parsed.status,
      summary: parsed.summary,
      sources: parsed.sources ?? [],
    }
  } catch {
    return {
      claimId: claim.id,
      status: 'unverified',
      summary: 'Could not generate a verdict for this claim.',
      sources: [],
    }
  }
}
