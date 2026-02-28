// Haiku: claim + sources → verdict
import { anthropic } from './anthropic.js'
import { VERDICT_COMPOSER_SYSTEM, buildVerdictComposerUser } from './prompts.js'
import { Claim, Source, Verdict } from './types.js'

export async function composeVerdict(claim: Claim, sources: Source[]): Promise<Verdict> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: VERDICT_COMPOSER_SYSTEM,
    messages: [{ role: 'user', content: buildVerdictComposerUser(claim, sources) }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'

  try {
    const raw: { status: Verdict['status']; summary: string } = JSON.parse(text)
    return {
      claimId: claim.id,
      status: raw.status,
      summary: raw.summary,
      sources,
    }
  } catch {
    return {
      claimId: claim.id,
      status: 'unverified',
      summary: 'Could not generate a verdict for this claim.',
      sources,
    }
  }
}
