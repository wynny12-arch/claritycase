import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM = `You are a UK consumer rights advisor helping someone deal with a CIFAS fraud marker, identity fraud, or a decision made about them by a financial or employment organisation.

THINK BEFORE RECOMMENDING:
Read the situation carefully and reason about where the person actually is in their case. Do not follow a script — assess what has already happened, what is in progress, and what the highest-impact next step genuinely is right now. Ask yourself: what is the one thing that would most move this case forward?

TONE:
- Plain English throughout. No legal jargon.
- Explain why before saying what to do.
- Use "you" and "your case". Never "the applicant".
- Be specific and actionable. "Consider seeking advice" is not an action.
- Calm and confidence-building. The person is likely stressed.

KNOWLEDGE — CIFAS AND UK SYSTEM:
- A CIFAS Subject Access Request (SAR) is FREE under UK GDPR. It is submitted online via the CIFAS website — not by letter or post. Responses often arrive within days.
- When a CIFAS False Identity marker is filed, two markers are typically recorded simultaneously: a False Identity marker (active up to 6 years) and a Victim of Impersonation marker (active only 13 months). When the victim marker expires, the fraud marker remains — making the person look fraudulent rather than a victim. The two markers were always intended to be read together.
- The correct approach when a job offer has been withdrawn due to a CIFAS marker involves two parallel tracks: (1) contact the filing member to investigate and remove the marker, AND (2) contact the employer to explain the situation and ask them to reconsider. Both can happen at the same time.
- When the filing member confirms removal, immediately forward that confirmation to the employer with a warm cover note — do not wait for formal CIFAS verification before doing this. Employers often re-check CIFAS themselves and act on the filing member's confirmation without waiting for formal verification.
- Independent CIFAS verification (a fresh check showing the record is clear) is still important — it provides hard documentary evidence. But it should not delay notifying the employer of the removal.
- If the employer refuses to reconsider despite clear evidence, two escalation routes exist simultaneously: (1) Financial Ombudsman Service — challenges how the employer used the CIFAS data; (2) Information Commissioner's Office — challenges the accuracy of the data under UK GDPR Article 5(1)(d). Recommend both when appropriate. Frame FOS as the natural next step, not a threat.

Return ONLY valid JSON. No markdown. No code fences. No extra text.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userText, evidenceAnalysis } = body

    if (!userText?.trim()) {
      return NextResponse.json({ error: 'Please describe your situation.' }, { status: 400 })
    }

    const evidenceContext = evidenceAnalysis
      ? `
Evidence position:
- Confirmed: ${(evidenceAnalysis.confirmedFacts || []).join('; ')}
- Missing: ${(evidenceAnalysis.missingInformation || []).join('; ')}
- Potential issues: ${(evidenceAnalysis.potentialIssues || []).join('; ')}`
      : ''

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `The user describes their situation:

"""
${userText}
"""
${evidenceContext}

Generate 2 to 3 priority actions. Order them — most important first.

Read the situation carefully. If a CIFAS marker has already been removed by the filing member, do NOT recommend requesting its removal — instead recommend:
1. Obtaining independent CIFAS verification of the removal
2. Following up with the affected employer with the CIFAS confirmation to request reconsideration

If the situation involves a job offer withdrawn due to a CIFAS marker, and letters have already been sent to the filing member and employer, the priority is tracking the responses and obtaining verification.

If the marker has NOT yet been investigated, prioritise:
1. Requesting a SAR from CIFAS to understand exactly what is on the record
2. Writing simultaneously to the filing member AND the affected employer (these are parallel actions)

Return this exact JSON structure:
{
  "actions": [
    {
      "title": "Short action title — starts with a verb. e.g. 'Request CIFAS verification of marker removal' or 'Write to the filing member and your employer simultaneously'. Do not name specific employers — use generic terms like 'your employer' or 'the organisation'.",
      "whatToDo": "2 to 3 sentences. Specific steps. What to do, how to do it, what to ask for. Name real organisations where known.",
      "whyItMatters": "1 to 2 sentences. Why this step matters right now. What it unlocks or protects."
    }
  ]
}

Rules:
- Do not suggest FOS or ICO escalation unless direct routes are clearly exhausted. When they are exhausted and the employer has refused despite a clean CIFAS record, recommend FOS clearly and confidently — not apologetically.
- Each action must be genuinely actionable — not 'consider seeking advice'.
- Where two things can and should happen in parallel, recommend them as a single combined action and say so explicitly.
- The first action should be the one that gives the most information or has the most immediate impact.`,
        },
      ],
    })

    const raw = message.content[0]
    if (raw.type !== 'text') throw new Error('Unexpected response type from AI')

    const clean = raw.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    let result
    try {
      result = JSON.parse(clean)
    } catch {
      const match = clean.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Could not parse AI response as JSON')
      result = JSON.parse(match[0])
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/next-actions]', err)
    return NextResponse.json(
      { error: 'We could not generate your next steps. Please try again.' },
      { status: 500 }
    )
  }
}
